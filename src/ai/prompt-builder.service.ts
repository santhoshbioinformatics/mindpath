// src/ai/prompt-builder.service.ts
import { Injectable } from '@nestjs/common';
import type { DailyCheckIn } from '@prisma/client';

interface CheckInContext {
  today: DailyCheckIn;
  yesterday: DailyCheckIn | null;
  weekAvgMood: number | null;
  weekAvgAnxiety: number | null;
  weekAvgOverall: number | null;
}

interface WeeklyContext {
  checkIns: DailyCheckIn[];
  reflectionTags: string[];
  medicationAdherence: number | null;
}

@Injectable()
export class PromptBuilder {
  // ── Daily insight ──────────────────────────────────────────────────────────
  dailyInsight(ctx: CheckInContext): string {
    const today = ctx.today;
    const delta =
      ctx.yesterday != null
        ? Math.round(today.overallScore - ctx.yesterday.overallScore)
        : null;

    const lines: string[] = [
      `=== Today's Check-in ===`,
      `Mood: ${today.mood}/100`,
      `Anxiety: ${today.anxiety}/100 (${this.anxietyLabel(today.anxiety)})`,
      `Energy: ${today.energy}/100`,
      `Mental clarity: ${today.clarity}/100`,
      `Sleep quality: ${today.sleepQuality}/100`,
      `Overall wellbeing: ${Math.round(today.overallScore)}/100`,
    ];

    if (today.stressTags.length > 0) {
      lines.push(`Stress context: ${today.stressTags.join(', ')}`);
    }

    if (delta !== null) {
      lines.push(`Change vs yesterday: ${delta > 0 ? '+' : ''}${delta} overall`);
    }

    if (ctx.weekAvgMood !== null) {
      lines.push(`7-day avg mood: ${ctx.weekAvgMood}`);
    }
    if (ctx.weekAvgOverall !== null) {
      lines.push(`7-day avg overall: ${ctx.weekAvgOverall}`);
    }

    if (today.notes) {
      lines.push(`User note: "${today.notes}"`);
    }

    lines.push('');
    lines.push(
      'Generate ONE specific, actionable insight based on the most notable pattern or change in this data.',
    );

    return lines.join('\n');
  }

  // ── Weekly narrative ────────────────────────────────────────────────────────
  weeklyNarrative(ctx: WeeklyContext): string {
    const { checkIns, reflectionTags, medicationAdherence } = ctx;

    if (!checkIns.length) return 'No check-in data available for this week.';

    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

    const avgMood = avg(checkIns.map((c) => c.mood));
    const avgAnxiety = avg(checkIns.map((c) => c.anxiety));
    const avgEnergy = avg(checkIns.map((c) => c.energy));
    const avgSleep = avg(checkIns.map((c) => c.sleepQuality));
    const avgOverall = avg(checkIns.map((c) => Math.round(c.overallScore)));
    const bestDay = checkIns.reduce((best, c) => (c.overallScore > best.overallScore ? c : best));
    const worstDay = checkIns.reduce(
      (worst, c) => (c.overallScore < worst.overallScore ? c : worst),
    );

    const stressTagFreq: Record<string, number> = {};
    checkIns.forEach((c) =>
      c.stressTags.forEach((t) => {
        stressTagFreq[t] = (stressTagFreq[t] ?? 0) + 1;
      }),
    );
    const topStressors = Object.entries(stressTagFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tag]) => tag);

    const lines = [
      `=== Weekly Data Summary (${checkIns.length}/7 days) ===`,
      `Average mood: ${avgMood}/100`,
      `Average anxiety: ${avgAnxiety}/100`,
      `Average energy: ${avgEnergy}/100`,
      `Average sleep quality: ${avgSleep}/100`,
      `Average overall wellbeing: ${avgOverall}/100`,
      `Best day overall: ${Math.round(bestDay.overallScore)} (${bestDay.checkedInAt.toISOString().split('T')[0]})`,
      `Most difficult day: ${Math.round(worstDay.overallScore)} (${worstDay.checkedInAt.toISOString().split('T')[0]})`,
    ];

    if (topStressors.length > 0) {
      lines.push(`Common stressors: ${topStressors.join(', ')}`);
    }
    if (reflectionTags.length > 0) {
      const tagFreq: Record<string, number> = {};
      reflectionTags.forEach((t) => { tagFreq[t] = (tagFreq[t] ?? 0) + 1; });
      const topJournalThemes = Object.entries(tagFreq)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([tag]) => tag);
      lines.push(`Journal themes: ${topJournalThemes.join(', ')}`);
    }
    if (medicationAdherence !== null) {
      lines.push(`Medication adherence: ${medicationAdherence}%`);
    }

    lines.push('');
    lines.push(
      'Write a warm, honest weekly summary. Acknowledge both wins and difficulties. Write in second person.',
    );

    return lines.join('\n');
  }

  // ── Assessment interpretation ───────────────────────────────────────────────
  assessmentInterpretation(
    assessmentType: string,
    score: number,
    severity: string,
    prevScore: number | null,
  ): string {
    const lines = [
      `Assessment type: ${assessmentType.replace(/_/g, ' ')}`,
      `Score: ${score}`,
      `Severity: ${severity}`,
    ];
    if (prevScore !== null) {
      const delta = score - prevScore;
      lines.push(`Change from last time: ${delta > 0 ? '+' : ''}${delta}`);
    }
    lines.push(
      '\nWrite 2 sentences interpreting this score in plain, warm language. No diagnosis. Reference the change if available.',
    );
    return lines.join('\n');
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  private anxietyLabel(score: number): string {
    if (score <= 25) return 'calm';
    if (score <= 50) return 'slightly tense';
    if (score <= 75) return 'moderately anxious';
    return 'highly anxious';
  }
}
