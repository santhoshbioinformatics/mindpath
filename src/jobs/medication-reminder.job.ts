// src/jobs/medication-reminder.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class MedicationReminderJob {
  private readonly logger = new Logger(MedicationReminderJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  // Every 30 minutes — check for overdue doses
  @Cron('*/30 * * * *')
  async checkOverdueDoses() {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();

    const medications = await this.prisma.medication.findMany({
      where: { isActive: true },
      include: { user: { include: { notifPrefs: true } } },
    });

    for (const med of medications) {
      if (!med.user.notifPrefs?.medicationEnabled) continue;

      for (const timeStr of med.reminderTimes) {
        const [remHour, remMin] = timeStr.split(':').map(Number);
        const reminderMinutes = remHour * 60 + remMin;
        const currentMinutes = currentHour * 60 + currentMinute;
        const minutesOverdue = currentMinutes - reminderMinutes;

        // If the reminder was 30-60 minutes ago and not yet logged
        if (minutesOverdue >= 30 && minutesOverdue < 60) {
          const today = new Date();
          today.setHours(remHour, remMin, 0, 0);

          const alreadyLogged = await this.prisma.medicationLog.findFirst({
            where: {
              medicationId: med.id,
              scheduledAt: {
                gte: new Date(today.getTime() - 30 * 60 * 1000),
                lte: new Date(today.getTime() + 30 * 60 * 1000),
              },
            },
          });

          if (!alreadyLogged) {
            await this.notifications
              .sendMedicationReminder(med.userId, med.name, med.id)
              .catch((e) =>
                this.logger.error(`Failed to send med reminder: ${e}`),
              );
          }
        }
      }
    }
  }
}
