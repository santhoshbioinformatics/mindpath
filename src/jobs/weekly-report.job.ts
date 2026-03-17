// src/jobs/weekly-report.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { subDays, startOfWeek, endOfWeek } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';
import { NotificationsService } from '../notifications/notifications.service';
import type { DailyCheckIn } from '@prisma/client';

function avg(arr: number[]): number {
  return arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;
}

@Injectable()
export class WeeklyReportJob {
  private readonly logger = new Logger(WeeklyReportJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIService,
    private readonly notifications: NotificationsService,
  ) {}

  // Sunday 6pm — generate reports and notify users
  @Cron('0 18 * * 0')
  async generateForAllUsers() {
    this.logger.log('Weekly report generation starting');

    const profiles = await this.prisma.userProfile.findMany({
      where: { onboardingDone: true },
      include: { user: { include: { notifPrefs: true } } },
    });

    let generated = 0;
    for (const profile of profiles) {
      try {
        const report = await this.generateForUser(profile.userId);
        if (report && profile.user.notifPrefs?.weeklyReportEnabled) {
          await this.notifications.sendWeeklyReportReady(profile.userId);
        }
        if (report) generated++;
      } catch (err) {
        this.logger.error(`Weekly report failed for ${profile.userId}`, err);
      }
      await new Promise((r) => setTimeout(r, 200)); // rate-limit AI calls
    }

    this.logger.log(`Weekly reports generated: ${generated}/${profiles.length}`);
  }

  async generateForUser(userId: string) {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 }); // Monday
    const weekEnd = endOfWeek(new Date(), { weekStartsOn: 1 });
    const weekAgo = subDays(new Date(), 7);

    const checkIns = await this.prisma.dailyCheckIn.findMany({
      where: { userId, checkedInAt: { gte: weekAgo } },
      orderBy: { checkedInAt: 'asc' },
    });

    if (checkIns.length === 0) return null;

    // Get previous week for delta comparison
    const prevWeekCheckIns = await this.prisma.dailyCheckIn.findMany({
      where: { userId, checkedInAt: { gte: subDays(new Date(), 14), lt: weekAgo } },
    });

    const medLogs = await this.prisma.medicationLog.findMany({
      where: { medication: { userId }, scheduledAt: { gte: weekAgo } },
    });

    const medAdherence =
      medLogs.length > 0
        ? Math.round(
            (medLogs.filter((l) => l.status === 'taken').length / medLogs.length) * 100,
          )
        : undefined;

    const metrics = {
      avgMood: avg(checkIns.map((c) => c.mood)),
      avgAnxiety: avg(checkIns.map((c) => c.anxiety)),
      avgEnergy: avg(checkIns.map((c) => c.energy)),
      avgClarity: avg(checkIns.map((c) => c.clarity)),
      avgSleep: avg(checkIns.map((c) => c.sleepQuality)),
      avgOverall: avg(checkIns.map((c) => Math.round(c.overallScore))),
      checkInCount: checkIns.length,
      medicationAdherence: medAdherence,
      prevWeekAvgMood: prevWeekCheckIns.length
        ? avg(prevWeekCheckIns.map((c) => c.mood))
        : undefined,
      prevWeekAvgOverall: prevWeekCheckIns.length
        ? avg(prevWeekCheckIns.map((c) => Math.round(c.overallScore)))
        : undefined,
    };

    const aiResult = await this.ai.generateWeeklyNarrative(userId);

    const highlights = this.extractHighlights(checkIns, metrics);
    const concerns = this.extractConcerns(checkIns, metrics);
    const suggestions = this.generateSuggestions(metrics);

    const reportId = `${userId}_${weekStart.toISOString().split('T')[0]}`;

    const report = await this.prisma.weeklyReport.upsert({
      where: { id: reportId },
      create: {
        id: reportId,
        userId,
        weekStart,
        weekEnd,
        narrative: aiResult.narrative,
        metrics,
        highlights: [...highlights, ...aiResult.highlights].slice(0, 4),
        improvements: aiResult.suggestions.slice(0, 2),
        concerns: [...concerns, ...aiResult.concerns].slice(0, 3),
        suggestions: [...suggestions, ...aiResult.suggestions].slice(0, 3),
      },
      update: {
        narrative: aiResult.narrative,
        metrics,
        highlights: [...highlights, ...aiResult.highlights].slice(0, 4),
        improvements: aiResult.suggestions.slice(0, 2),
        concerns: [...concerns, ...aiResult.concerns].slice(0, 3),
        suggestions: [...suggestions, ...aiResult.suggestions].slice(0, 3),
      },
    });

    this.logger.log(`Weekly report saved: ${reportId}`);
    return report;
  }

  private extractHighlights(
    checkIns: DailyCheckIn[],
    metrics: { checkInCount: number; avgMood: number; avgOverall: number; prevWeekAvgMood?: number },
  ): string[] {
    const h: string[] = [];
    if (metrics.checkInCount >= 5) h.push(`Checked in ${metrics.checkInCount}/7 days`);
    if (metrics.avgMood >= 70) h.push(`Strong mood week — avg ${metrics.avgMood}`);
    if (metrics.prevWeekAvgMood && metrics.avgMood > metrics.prevWeekAvgMood + 5) {
      h.push(`↑ Mood improved ${metrics.avgMood - metrics.prevWeekAvgMood} pts vs last week`);
    }
    const bestDay = checkIns.reduce((b, c) => (c.overallScore > b.overallScore ? c : b));
    if (Math.round(bestDay.overallScore) >= 75) {
      h.push(`Best day: ${Math.round(bestDay.overallScore)} overall`);
    }
    return h.slice(0, 3);
  }

  private extractConcerns(
    checkIns: DailyCheckIn[],
    metrics: { avgAnxiety: number; avgSleep: number; prevWeekAvgMood?: number; avgMood: number },
  ): string[] {
    const c: string[] = [];
    if (metrics.avgAnxiety > 60) c.push('Anxiety elevated this week');
    if (metrics.avgSleep < 45) c.push('Sleep quality below average');
    const highAnxDays = checkIns.filter((ci) => ci.anxiety > 70).length;
    if (highAnxDays >= 3) c.push(`High anxiety on ${highAnxDays} days`);
    if (metrics.prevWeekAvgMood && metrics.avgMood < metrics.prevWeekAvgMood - 8) {
      c.push('Mood dropped vs last week');
    }
    return c.slice(0, 2);
  }

  private generateSuggestions(metrics: {
    avgSleep: number;
    avgAnxiety: number;
    avgMood: number;
    checkInCount: number;
  }): string[] {
    const s: string[] = [];
    if (metrics.avgSleep < 50) s.push('Prioritize a consistent sleep schedule');
    if (metrics.avgAnxiety > 55) s.push('Try a daily 5-min breathing exercise');
    if (metrics.avgMood < 50) s.push('Log one social interaction per day');
    if (metrics.checkInCount < 5) s.push('Aim for daily check-ins next week');
    s.push('Keep up your streak');
    return s.slice(0, 3);
  }
}
