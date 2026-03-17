// src/notifications/notifications.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

interface ExpoPushPayload {
  to: string | string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
  priority?: 'default' | 'normal' | 'high';
}

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private readonly EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private async getUserTokens(userId: string): Promise<string[]> {
    const tokens = await this.prisma.pushToken.findMany({
      where: { userId },
      select: { token: true },
    });
    return tokens.map((t) => t.token);
  }

  private async sendPush(
    userId: string,
    payload: Omit<ExpoPushPayload, 'to'>,
  ): Promise<void> {
    const tokens = await this.getUserTokens(userId);
    if (!tokens.length) return;

    const messages: ExpoPushPayload[] = tokens.map((token) => ({
      to: token,
      ...payload,
    }));

    try {
      const response = await fetch(this.EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(this.config.get('EXPO_ACCESS_TOKEN')
            ? {
                Authorization: `Bearer ${this.config.get('EXPO_ACCESS_TOKEN')}`,
              }
            : {}),
        },
        body: JSON.stringify(messages),
      });

      if (!response.ok) {
        this.logger.warn(
          `Push failed: ${response.status} ${response.statusText}`,
        );
      }
    } catch (err) {
      this.logger.error('Push notification error', err);
    }
  }

  async sendCheckInReminder(userId: string): Promise<void> {
    await this.sendPush(userId, {
      title: 'Time for your daily check-in',
      body: 'Take 3 minutes to check in with yourself. How are you feeling?',
      data: { screen: '/(tabs)/checkin' },
      sound: 'default',
    });
  }

  async sendMedicationReminder(
    userId: string,
    medicationName: string,
    medicationId: string,
  ): Promise<void> {
    await this.sendPush(userId, {
      title: `Time for ${medicationName}`,
      body: 'Tap to log your medication',
      data: {
        screen: '/(tabs)/profile',
        medicationId,
        action: 'log_medication',
      },
      sound: 'default',
      priority: 'high',
    });
  }

  async sendStreakMilestone(userId: string, streak: number): Promise<void> {
    const messages: Record<number, { title: string; body: string }> = {
      7: {
        title: '7-day streak! 🔥',
        body: "One week of showing up for yourself. That's real momentum.",
      },
      14: {
        title: '2-week streak! 🔥',
        body: "Two weeks strong. You're building a habit that will pay off.",
      },
      30: {
        title: '30-day streak! 🌟',
        body: 'A month of daily check-ins. You now have a real picture of your patterns.',
      },
      60: {
        title: '60-day streak! 💪',
        body: 'Two months of consistent self-awareness. Remarkable.',
      },
      100: {
        title: '100-day streak! 🏆',
        body: "100 days of showing up. That's extraordinary.",
      },
    };

    const msg = messages[streak] ?? {
      title: `${streak}-day streak! 🔥`,
      body: "You've been consistently showing up for yourself.",
    };

    await this.sendPush(userId, {
      ...msg,
      data: { screen: '/(tabs)/' },
      sound: 'default',
    });
  }

  async sendWeeklyReportReady(userId: string): Promise<void> {
    await this.sendPush(userId, {
      title: 'Your weekly report is ready',
      body: 'See what patterns emerged this week and what changed.',
      data: { screen: '/reports/weekly' },
      sound: 'default',
    });
  }

  async sendReEngagement(userId: string, lastStreak: number): Promise<void> {
    const body =
      lastStreak >= 3
        ? `You had a ${lastStreak}-day streak going. No pressure — just checking in on you.`
        : "Just checking in — how are you doing? Take a moment whenever you're ready.";

    await this.sendPush(userId, {
      title: "We haven't heard from you in a few days",
      body,
      data: { screen: '/(tabs)/checkin' },
      sound: null,
    });
  }

  async scheduleSafetyFollowUp(
    userId: string,
    checkInId: string,
  ): Promise<void> {
    this.logger.log(
      `Safety follow-up scheduled for user ${userId} (checkIn: ${checkInId})`,
    );
    await this.prisma.alert.create({
      data: {
        userId,
        type: 'safety',
        severity: 'info',
        title: 'safety_followup_scheduled',
        body: checkInId,
        isAcked: false,
      },
    });
  }

  async sendSafetyFollowUp(userId: string): Promise<void> {
    await this.sendPush(userId, {
      title: "We're thinking of you",
      body: "How are you feeling today? We're here whenever you want to check in.",
      data: { screen: '/(tabs)/checkin' },
      sound: null,
    });
  }

  async sendMagicLinkEmail(email: string, token: string): Promise<void> {
    const baseUrl = this.config.get<string>(
      'APP_URL',
      'https://app.mindpath.io',
    );
    const link = `${baseUrl}/auth/magic-link/verify?token=${token}`;
    this.logger.log(`Magic link for ${email}: ${link}`);
    // Connect nodemailer / Resend here in production
  }

  async isInQuietHours(userId: string): Promise<boolean> {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    if (!prefs?.quietHoursStart || !prefs?.quietHoursEnd) return false;

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const [startH, startM] = prefs.quietHoursStart.split(':').map(Number);
    const [endH, endM] = prefs.quietHoursEnd.split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    if (startMinutes <= endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
    }
    return currentMinutes >= startMinutes || currentMinutes <= endMinutes;
  }
}
