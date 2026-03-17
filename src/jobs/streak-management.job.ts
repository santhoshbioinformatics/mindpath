// src/jobs/streak-management.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { differenceInCalendarDays, subDays } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class StreakManagementJob {
  private readonly logger = new Logger(StreakManagementJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // 11pm daily — reset broken streaks and send re-engagement
  @Cron('0 23 * * *')
  async checkStreaksAndReEngage() {
    this.logger.log('Running streak management');

    const profiles = await this.prisma.userProfile.findMany({
      where: { currentStreak: { gt: 0 } },
      select: { userId: true, currentStreak: true, lastCheckIn: true },
    });

    const today = new Date();
    let broken = 0;
    let reEngaged = 0;

    for (const profile of profiles) {
      if (!profile.lastCheckIn) continue;

      const daysSince = differenceInCalendarDays(today, profile.lastCheckIn);

      if (daysSince > 1) {
        await this.prisma.userProfile.update({
          where: { userId: profile.userId },
          data: { currentStreak: 0 },
        });
        broken++;

        // Send re-engagement nudge for streaks that were >= 3 days
        if (profile.currentStreak >= 3 && daysSince === 2) {
          await this.notifications
            .sendReEngagement(profile.userId, profile.currentStreak)
            .catch(() => null);
          reEngaged++;
        }
      }
    }

    // Also nudge users who haven't checked in for exactly 3 days
    const threeDaysAgo = subDays(today, 3);
    const lapsedUsers = await this.prisma.userProfile.findMany({
      where: {
        lastCheckIn: {
          gte: new Date(new Date(threeDaysAgo).setHours(0, 0, 0, 0)),
          lte: new Date(new Date(threeDaysAgo).setHours(23, 59, 59, 999)),
        },
        currentStreak: 0,
      },
      select: { userId: true },
    });

    for (const { userId } of lapsedUsers) {
      await this.notifications.sendReEngagement(userId, 0).catch(() => null);
      reEngaged++;
    }

    this.logger.log(
      `Streak job complete: ${broken} broken, ${reEngaged} re-engagement sent`,
    );
  }
}
