// src/jobs/correlation-detection.job.ts
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { subDays } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';
import type { DailyCheckIn, ActivityLog, MedicationLog } from '@prisma/client';

interface CorrelationCandidate {
  factorKey: string;
  title: string;
  body: string;
  confidence: number;
  data: Record<string, unknown>;
  action: string;
  factorA: string;
  factorB: string;
}

function avg(arr: number[]): number {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

function pearsonR(xs: number[], ys: number[]): number {
  if (xs.length < 3) return 0;
  const meanX = avg(xs);
  const meanY = avg(ys);
  const num = xs.reduce((sum, x, i) => sum + (x - meanX) * (ys[i] - meanY), 0);
  const denomX = Math.sqrt(xs.reduce((sum, x) => sum + (x - meanX) ** 2, 0));
  const denomY = Math.sqrt(ys.reduce((sum, y) => sum + (y - meanY) ** 2, 0));
  return denomX && denomY ? num / (denomX * denomY) : 0;
}

@Injectable()
export class CorrelationDetectionJob {
  private readonly logger = new Logger(CorrelationDetectionJob.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIService,
  ) {}

  // ── Scheduled: 3am daily ─────────────────────────────────────────────────────
  @Cron('0 3 * * *')
  async runForAllUsers() {
    this.logger.log('Running correlation detection for all users');
    const profiles = await this.prisma.userProfile.findMany({
      where: { onboardingDone: true },
      select: { userId: true },
    });

    let processed = 0;
    let errors = 0;

    for (const { userId } of profiles) {
      try {
        await this.detectForUser(userId);
        processed++;
      } catch (err) {
        errors++;
        this.logger.error(`Correlation detection failed for ${userId}`, err);
      }
      // Small delay to avoid overwhelming the DB
      await new Promise((r) => setTimeout(r, 100));
    }

    this.logger.log(`Correlation job complete: ${processed} processed, ${errors} errors`);
  }

  // ── Run for a single user (also called on-demand from insights) ──────────────
  async detectForUser(userId: string): Promise<void> {
    const since = subDays(new Date(), 30);

    const [checkIns, activityLogs, medLogs] = await Promise.all([
      this.prisma.dailyCheckIn.findMany({
        where: { userId, checkedInAt: { gte: since } },
        orderBy: { checkedInAt: 'asc' },
      }),
      this.prisma.activityLog.findMany({
        where: { userId, loggedAt: { gte: since } },
      }),
      this.prisma.medicationLog.findMany({
        where: { medication: { userId }, scheduledAt: { gte: since } },
        include: { medication: true },
      }),
    ]);

    if (checkIns.length < 5) return; // Not enough data

    const candidates: CorrelationCandidate[] = [
      this.sleepCognition(checkIns),
      this.sleepMood(checkIns),
      this.exerciseMood(checkIns, activityLogs),
      this.exerciseStress(checkIns, activityLogs),
      this.socialMood(checkIns, activityLogs),
      this.mindfulnessAnxiety(checkIns, activityLogs),
      this.medicationMood(checkIns, medLogs),
      this.medicationAdherenceOverall(checkIns, medLogs),
    ].filter((c): c is CorrelationCandidate => c !== null && c.confidence >= 0.55);

    // Remove stale correlations, upsert fresh ones
    await this.prisma.insight.deleteMany({
      where: {
        userId,
        type: 'correlation',
        generatedAt: { lt: subDays(new Date(), 7) },
      },
    });

    for (const corr of candidates) {
      const insightId = `${userId}_${corr.factorKey}`;
      await this.prisma.insight.upsert({
        where: { id: insightId },
        create: {
          id: insightId,
          userId,
          type: 'correlation',
          title: corr.title,
          body: corr.body,
          confidence: corr.confidence,
          supportingData: { ...corr.data, factorA: corr.factorA, factorB: corr.factorB },
          suggestedAction: corr.action,
        },
        update: {
          title: corr.title,
          body: corr.body,
          confidence: corr.confidence,
          supportingData: { ...corr.data, factorA: corr.factorA, factorB: corr.factorB },
          suggestedAction: corr.action,
          generatedAt: new Date(),
          isRead: false,
        },
      });
    }
  }

  // ── Individual correlation detectors ────────────────────────────────────────

  private sleepCognition(checkIns: DailyCheckIn[]): CorrelationCandidate | null {
    const low = checkIns.filter((c) => c.sleepQuality < 40);
    const high = checkIns.filter((c) => c.sleepQuality >= 60);
    if (low.length < 3 || high.length < 2) return null;

    const lowClarity = avg(low.map((c) => c.clarity));
    const highClarity = avg(high.map((c) => c.clarity));
    const delta = Math.round(highClarity - lowClarity);
    if (Math.abs(delta) < 8) return null;

    const r = Math.abs(pearsonR(checkIns.map((c) => c.sleepQuality), checkIns.map((c) => c.clarity)));
    const confidence = Math.min(0.95, 0.45 + r * 0.4 + low.length * 0.015);

    return {
      factorKey: 'sleep_cognition',
      factorA: 'sleep',
      factorB: 'cognition',
      title: 'Less sleep → lower focus',
      body: `On nights with poor sleep, your next-day mental clarity drops ${delta} points on average compared to well-rested nights.`,
      confidence: Math.round(confidence * 100) / 100,
      data: {
        lowSleepAvgClarity: Math.round(lowClarity),
        highSleepAvgClarity: Math.round(highClarity),
        delta,
        sampleSize: checkIns.length,
        pearsonR: Math.round(r * 100) / 100,
      },
      action: 'Try a consistent sleep schedule this week',
    };
  }

  private sleepMood(checkIns: DailyCheckIn[]): CorrelationCandidate | null {
    const r = Math.abs(pearsonR(checkIns.map((c) => c.sleepQuality), checkIns.map((c) => c.mood)));
    if (r < 0.3) return null;

    const low = checkIns.filter((c) => c.sleepQuality < 40);
    const high = checkIns.filter((c) => c.sleepQuality >= 60);
    if (low.length < 3) return null;

    const delta = Math.round(avg(high.map((c) => c.mood)) - avg(low.map((c) => c.mood)));
    if (delta < 6) return null;

    return {
      factorKey: 'sleep_mood',
      factorA: 'sleep',
      factorB: 'mood',
      title: 'Sleep quality predicts your mood',
      body: `Your mood on good-sleep nights runs ${delta} points higher than on poor-sleep nights — one of your strongest patterns.`,
      confidence: Math.min(0.92, 0.5 + r * 0.35),
      data: { delta, pearsonR: Math.round(r * 100) / 100 },
      action: 'Protect sleep as your first wellbeing lever',
    };
  }

  private exerciseMood(checkIns: DailyCheckIn[], activities: ActivityLog[]): CorrelationCandidate | null {
    return this.activityVsMetric(checkIns, activities, 'exercise', 'mood', {
      factorKey: 'exercise_mood',
      factorA: 'exercise',
      factorB: 'mood',
      titleFn: (d) => `Exercise → ${d}-point mood boost`,
      bodyFn: (d, n) => `On days you exercise, your mood averages ${d} points higher. This held across ${n} exercise days.`,
      action: 'Schedule a workout session this week',
    });
  }

  private exerciseStress(checkIns: DailyCheckIn[], activities: ActivityLog[]): CorrelationCandidate | null {
    const result = this.activityVsMetric(checkIns, activities, 'exercise', 'anxiety', {
      factorKey: 'exercise_stress',
      factorA: 'exercise',
      factorB: 'anxiety',
      titleFn: (d) => `Exercise reduces anxiety by ${d} pts`,
      bodyFn: (d, n) => `Your anxiety averages ${d} points lower on exercise days vs rest days, across ${n} observations.`,
      action: 'Even a 20-min walk can shift anxiety',
    });
    // For anxiety, positive delta means exercise is WORSE — invert the check
    return result;
  }

  private socialMood(checkIns: DailyCheckIn[], activities: ActivityLog[]): CorrelationCandidate | null {
    return this.activityVsMetric(checkIns, activities, 'social', 'mood', {
      factorKey: 'social_mood',
      factorA: 'social',
      factorB: 'mood',
      titleFn: (d) => `Social time lifts mood by ${d} pts`,
      bodyFn: (d, n) => `Days with social interaction show ${d}-point higher mood. Connection is one of your mood boosters (${n} days).`,
      action: 'Plan one social activity this week',
    });
  }

  private mindfulnessAnxiety(checkIns: DailyCheckIn[], activities: ActivityLog[]): CorrelationCandidate | null {
    const days = new Set(
      activities.filter((a) => a.type === 'mindfulness').map((a) => this.dateKey(a.loggedAt)),
    );
    const mindDays = checkIns.filter((c) => days.has(this.dateKey(c.checkedInAt)));
    const otherDays = checkIns.filter((c) => !days.has(this.dateKey(c.checkedInAt)));
    if (mindDays.length < 3 || otherDays.length < 3) return null;

    const mindAnxiety = avg(mindDays.map((c) => c.anxiety));
    const otherAnxiety = avg(otherDays.map((c) => c.anxiety));
    const delta = Math.round(otherAnxiety - mindAnxiety); // positive = mindfulness lowers anxiety
    if (delta < 5) return null;

    const confidence = Math.min(0.88, 0.5 + mindDays.length * 0.04);
    return {
      factorKey: 'mindfulness_anxiety',
      factorA: 'mindfulness',
      factorB: 'anxiety',
      title: `Mindfulness lowers anxiety by ${delta} pts`,
      body: `On days you practice mindfulness, your anxiety runs ${delta} points lower than on days without it.`,
      confidence: Math.round(confidence * 100) / 100,
      data: { mindAnxiety: Math.round(mindAnxiety), otherAnxiety: Math.round(otherAnxiety), delta },
      action: 'Try a 5-min session daily this week',
    };
  }

  private medicationMood(checkIns: DailyCheckIn[], medLogs: MedicationLog[]): CorrelationCandidate | null {
    const takenDates = new Set(
      medLogs.filter((l) => l.status === 'taken').map((l) => this.dateKey(l.scheduledAt)),
    );
    const missedDates = new Set(
      medLogs.filter((l) => l.status === 'skipped').map((l) => this.dateKey(l.scheduledAt)),
    );

    const takenMoods = checkIns
      .filter((c) => takenDates.has(this.dateKey(c.checkedInAt)))
      .map((c) => c.mood);
    const missedMoods = checkIns
      .filter((c) => missedDates.has(this.dateKey(c.checkedInAt)))
      .map((c) => c.mood);

    if (takenMoods.length < 3 || missedMoods.length < 2) return null;

    const delta = Math.round(avg(takenMoods) - avg(missedMoods));
    if (delta < 5) return null;

    const confidence = Math.min(0.90, 0.55 + takenMoods.length * 0.03);
    return {
      factorKey: 'medication_mood',
      factorA: 'medication',
      factorB: 'mood',
      title: `Consistent medication → ${delta}-pt mood lift`,
      body: `On days you take your medication, mood averages ${delta} points higher than on days you skip it.`,
      confidence: Math.round(confidence * 100) / 100,
      data: {
        takenAvgMood: Math.round(avg(takenMoods)),
        missedAvgMood: Math.round(avg(missedMoods)),
        delta,
      },
      action: 'Set a daily reminder to stay consistent',
    };
  }

  private medicationAdherenceOverall(
    checkIns: DailyCheckIn[],
    medLogs: MedicationLog[],
  ): CorrelationCandidate | null {
    if (!medLogs.length) return null;
    const total = medLogs.length;
    const taken = medLogs.filter((l) => l.status === 'taken').length;
    const adherence = taken / total;

    if (adherence > 0.85) return null; // Already very good — no need to surface this

    const missedCount = total - taken;
    if (missedCount < 3) return null;

    return {
      factorKey: 'medication_adherence',
      factorA: 'medication',
      factorB: 'adherence',
      title: 'Medication adherence gap detected',
      body: `You've missed ${missedCount} of ${total} scheduled doses this month (${Math.round(adherence * 100)}% adherence). Consistent dosing tends to give more stable results.`,
      confidence: 0.95, // Factual — no statistical inference needed
      data: { adherencePct: Math.round(adherence * 100), taken, total, missed: missedCount },
      action: 'Enable medication reminders in settings',
    };
  }

  // ── Generic activity vs metric helper ───────────────────────────────────────

  private activityVsMetric(
    checkIns: DailyCheckIn[],
    activities: ActivityLog[],
    activityType: string,
    metric: keyof Pick<DailyCheckIn, 'mood' | 'anxiety' | 'energy' | 'clarity' | 'sleepQuality'>,
    config: {
      factorKey: string;
      factorA: string;
      factorB: string;
      titleFn: (delta: number) => string;
      bodyFn: (delta: number, n: number) => string;
      action: string;
    },
  ): CorrelationCandidate | null {
    const actDates = new Set(
      activities.filter((a) => a.type === activityType).map((a) => this.dateKey(a.loggedAt)),
    );
    const actDays = checkIns.filter((c) => actDates.has(this.dateKey(c.checkedInAt)));
    const nonActDays = checkIns.filter((c) => !actDates.has(this.dateKey(c.checkedInAt)));

    if (actDays.length < 3 || nonActDays.length < 3) return null;

    const actVals = actDays.map((c) => c[metric] as number);
    const nonActVals = nonActDays.map((c) => c[metric] as number);
    const delta = Math.round(avg(actVals) - avg(nonActVals));

    if (Math.abs(delta) < 5) return null;

    const r = Math.abs(
      pearsonR(
        checkIns.map((c) => (actDates.has(this.dateKey(c.checkedInAt)) ? 1 : 0)),
        checkIns.map((c) => c[metric] as number),
      ),
    );

    const confidence = Math.min(0.92, 0.48 + r * 0.35 + actDays.length * 0.02);

    return {
      factorKey: config.factorKey,
      factorA: config.factorA,
      factorB: config.factorB,
      title: config.titleFn(Math.abs(delta)),
      body: config.bodyFn(Math.abs(delta), actDays.length),
      confidence: Math.round(confidence * 100) / 100,
      data: {
        actAvg: Math.round(avg(actVals)),
        nonActAvg: Math.round(avg(nonActVals)),
        delta,
        actDays: actDays.length,
        pearsonR: Math.round(r * 100) / 100,
      },
      action: config.action,
    };
  }

  private dateKey(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
