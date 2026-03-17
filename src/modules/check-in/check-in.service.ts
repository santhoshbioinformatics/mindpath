// src/modules/check-in/check-in.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService } from '../../ai/ai.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreateCheckInDto } from './dto/check-in.dto';
import {
  startOfDay,
  endOfDay,
  subDays,
  differenceInCalendarDays,
} from 'date-fns';

@Injectable()
export class CheckInService {
  private readonly logger = new Logger(CheckInService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIService,
    private readonly notifications: NotificationsService,
  ) {}

  async create(userId: string, dto: CreateCheckInDto) {
    const overallScore = this.computeScore(dto);

    // Prevent double check-in on same day — update instead
    const existing = await this.getToday(userId);
    if (existing) {
      const updated = await this.prisma.dailyCheckIn.update({
        where: { id: existing.id },
        data: { ...dto, overallScore },
      });
      return { checkIn: updated, insight: null, isUpdate: true };
    }

    const checkIn = await this.prisma.dailyCheckIn.create({
      data: {
        userId,
        mood: dto.mood,
        anxiety: dto.anxiety,
        energy: dto.energy,
        clarity: dto.clarity,
        sleepQuality: dto.sleepQuality,
        motivation: dto.motivation,
        socialConnection: dto.socialConnection,
        stressTags: dto.stressTags,
        notes: dto.notes,
        overallScore,
      },
    });

    const [insight, newStreak] = await Promise.all([
      this.ai.generateDailyInsight(userId, checkIn).catch(() => null),
      this.updateStreak(userId),
      this.auditLog(userId, checkIn.id),
      this.runSafetyChecks(userId, dto, checkIn.id),
    ]);

    const MILESTONES = [7, 14, 30, 60, 100];
    if (MILESTONES.includes(newStreak)) {
      await this.notifications
        .sendStreakMilestone(userId, newStreak)
        .catch(() => null);
    }

    return { checkIn, insight, streak: newStreak, isUpdate: false };
  }

  async getToday(userId: string) {
    const now = new Date();
    return this.prisma.dailyCheckIn.findFirst({
      where: {
        userId,
        checkedInAt: { gte: startOfDay(now), lte: endOfDay(now) },
      },
      orderBy: { checkedInAt: 'desc' },
    });
  }

  async getHistory(
    userId: string,
    opts: { from?: string; to?: string; limit?: number },
  ) {
    const checkIns = await this.prisma.dailyCheckIn.findMany({
      where: {
        userId,
        checkedInAt: {
          gte: opts.from ? new Date(opts.from) : subDays(new Date(), 30),
          lte: opts.to ? new Date(opts.to) : new Date(),
        },
      },
      orderBy: { checkedInAt: 'desc' },
      take: opts.limit ? Number(opts.limit) : 90,
    });
    return { checkIns };
  }

  async getStreak(userId: string) {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    return {
      current: profile?.currentStreak ?? 0,
      longest: profile?.longestStreak ?? 0,
      lastCheckIn: profile?.lastCheckIn,
    };
  }

  async getSummary(userId: string, days: number) {
    const checkIns = await this.prisma.dailyCheckIn.findMany({
      where: { userId, checkedInAt: { gte: subDays(new Date(), days) } },
    });

    if (!checkIns.length) {
      return {
        checkInCount: 0,
        avgMood: null,
        avgAnxiety: null,
        avgOverall: null,
      };
    }

    const avg = (arr: number[]) =>
      Math.round(arr.reduce((a, b) => a + b, 0) / arr.length);

    return {
      checkInCount: checkIns.length,
      avgMood: avg(checkIns.map((c) => c.mood)),
      avgAnxiety: avg(checkIns.map((c) => c.anxiety)),
      avgEnergy: avg(checkIns.map((c) => c.energy)),
      avgClarity: avg(checkIns.map((c) => c.clarity)),
      avgSleep: avg(checkIns.map((c) => c.sleepQuality)),
      avgOverall: avg(checkIns.map((c) => Math.round(c.overallScore))),
      bestDay: checkIns.reduce((best, c) =>
        c.overallScore > best.overallScore ? c : best,
      ),
      worstDay: checkIns.reduce((worst, c) =>
        c.overallScore < worst.overallScore ? c : worst,
      ),
    };
  }

  private computeScore(dto: CreateCheckInDto): number {
    const calm = 100 - dto.anxiety;
    return Math.round(
      (dto.mood + dto.energy + (dto.clarity ?? 50) + calm + dto.sleepQuality) /
        5,
    );
  }

  private async updateStreak(userId: string): Promise<number> {
    const profile = await this.prisma.userProfile.findUnique({
      where: { userId },
    });
    if (!profile) return 1;

    const last = profile.lastCheckIn;
    let newStreak = 1;

    if (last) {
      const diff = differenceInCalendarDays(new Date(), last);
      if (diff === 0) {
        newStreak = profile.currentStreak;
      } else if (diff === 1) {
        newStreak = profile.currentStreak + 1;
      }
    }

    await this.prisma.userProfile.update({
      where: { userId },
      data: {
        currentStreak: newStreak,
        longestStreak: Math.max(newStreak, profile.longestStreak ?? 0),
        lastCheckIn: new Date(),
      },
    });

    return newStreak;
  }

  private async runSafetyChecks(
    userId: string,
    dto: CreateCheckInDto,
    checkInId: string,
  ): Promise<void> {
    const isCritical = dto.mood <= 10 || dto.anxiety >= 95;
    const isWarning = dto.mood <= 20 || dto.anxiety >= 80;

    if (!isWarning && !isCritical) return;

    await this.prisma.alert.create({
      data: {
        userId,
        type: 'safety',
        severity: isCritical ? 'critical' : 'warning',
        title: 'We noticed you may be struggling today',
        body: isCritical
          ? 'Your check-in suggests significant distress. If you need support now, please call or text 988.'
          : 'Your check-in shows some difficulty today. Remember that support is available.',
      },
    });

    await this.notifications.scheduleSafetyFollowUp(userId, checkInId);
    this.logger.warn(
      `Safety alert for ${userId} (${isCritical ? 'critical' : 'warning'})`,
    );
  }

  private async auditLog(userId: string, checkInId: string): Promise<void> {
    await this.prisma.auditLog.create({
      data: { userId, action: 'checkin_created', metadata: { checkInId } },
    });
  }
}
