// src/ai/ai.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';
import { subDays } from 'date-fns';
import { PrismaService } from '../prisma/prisma.service';
import { GuardrailsService } from './guardrails.service';
import { PromptBuilder } from './prompt-builder.service';
import type { DailyCheckIn, InsightType } from '@prisma/client';

export interface DailyInsightResult {
  title: string;
  body: string;
  suggestedAction: string;
  confidence?: number;
}

export interface WeeklyNarrativeResult {
  narrative: string;
  highlights: string[];
  concerns: string[];
  suggestions: string[];
}

export interface CorrelationResult {
  factorKey: string;
  title: string;
  body: string;
  confidence: number;
  data: Record<string, unknown>;
  action: string;
  factorA: string;
  factorB: string;
}

@Injectable()
export class AIService {
  private readonly logger = new Logger(AIService.name);
  private readonly client: Anthropic;
  private readonly MODEL = 'claude-sonnet-4-20250514';

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly guardrails: GuardrailsService,
    private readonly promptBuilder: PromptBuilder,
  ) {
    this.client = new Anthropic({
      apiKey: this.config.get<string>('ANTHROPIC_API_KEY'),
    });
  }

  // ─────────────────────────────────────────────────────────────────────────
  // DAILY INSIGHT
  // ─────────────────────────────────────────────────────────────────────────

  async generateDailyInsight(userId: string, checkIn: DailyCheckIn) {
    try {
      const context = await this.buildCheckInContext(userId, checkIn);
      const prompt = this.promptBuilder.dailyInsight(context);

      const message = await this.callClaude({
        system: `You are a supportive, calm mental wellness assistant.
Generate one specific, actionable insight based on today's check-in.
Never make diagnostic claims. Be warm, brief, and encouraging.
Respond ONLY with valid JSON — no markdown, no explanation:
{"title": "string (≤8 words)", "body": "string (≤65 words)", "suggestedAction": "string (≤15 words)"}`,
        user: prompt,
        maxTokens: 300,
      });

      const parsed = this.parseJSON<DailyInsightResult>(message);
      if (!parsed || !this.guardrails.isInsightSafe(parsed.body)) {
        return this.guardrails.getFallbackInsight(Math.round(checkIn.overallScore));
      }

      // Persist insight
      const insight = await this.prisma.insight.create({
        data: {
          userId,
          type: 'daily' as InsightType,
          title: parsed.title,
          body: parsed.body,
          suggestedAction: parsed.suggestedAction,
          expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
        },
      });

      return insight;
    } catch (err) {
      this.logger.error('generateDailyInsight failed', err);
      return null;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // WEEKLY NARRATIVE
  // ─────────────────────────────────────────────────────────────────────────

  async generateWeeklyNarrative(userId: string): Promise<WeeklyNarrativeResult> {
    const FALLBACK: WeeklyNarrativeResult = {
      narrative: 'Your weekly summary is being generated. Check back shortly.',
      highlights: [],
      concerns: [],
      suggestions: ['Continue your daily check-ins to build better insights.'],
    };

    try {
      const weekAgo = subDays(new Date(), 7);
      const checkIns = await this.prisma.dailyCheckIn.findMany({
        where: { userId, checkedInAt: { gte: weekAgo } },
        orderBy: { checkedInAt: 'asc' },
      });

      if (checkIns.length < 2) return FALLBACK;

      const reflections = await this.prisma.reflectionEntry.findMany({
        where: { userId, reflectedAt: { gte: weekAgo } },
        select: { tags: true, aiSummary: true },
      });

      const medAdherence = await this.getMedicationAdherence(userId);

      const prompt = this.promptBuilder.weeklyNarrative({
        checkIns,
        reflectionTags: reflections.flatMap((r) => r.tags),
        medicationAdherence: medAdherence,
      });

      const message = await this.callClaude({
        system: `You are a supportive wellness analytics assistant.
Write a warm, honest weekly summary for the user.
Do not use clinical language. Be encouraging but truthful.
Respond ONLY with valid JSON:
{
  "narrative": "string (150-180 words, second person)",
  "highlights": ["string (≤10 words each)", ...up to 3],
  "concerns": ["string (≤10 words each)", ...up to 2],
  "suggestions": ["string (≤12 words each)", ...up to 3]
}`,
        user: prompt,
        maxTokens: 600,
      });

      const parsed = this.parseJSON<WeeklyNarrativeResult>(message);
      return parsed ?? FALLBACK;
    } catch (err) {
      this.logger.error('generateWeeklyNarrative failed', err);
      return FALLBACK;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // REFLECTION SUMMARY
  // ─────────────────────────────────────────────────────────────────────────

  async summarizeReflection(reflection: {
    wentWell?: string;
    wasDifficult?: string;
    learned?: string;
    mattersNow?: string;
    freeText?: string;
  }): Promise<string> {
    try {
      const content = [
        reflection.wentWell && `Went well: ${reflection.wentWell}`,
        reflection.wasDifficult && `Difficult: ${reflection.wasDifficult}`,
        reflection.learned && `Learned: ${reflection.learned}`,
        reflection.mattersNow && `Matters now: ${reflection.mattersNow}`,
        reflection.freeText,
      ]
        .filter(Boolean)
        .join('\n');

      if (!content.trim()) return '';

      const message = await this.callClaude({
        system: `You are a warm, empathetic journal companion.
Reflect back what the user wrote in 2 brief sentences (≤55 words total).
Be genuine and caring. Notice the emotional texture, not just the facts.
Do not give advice. No clinical language. Write in a direct, personal tone.`,
        user: `Please summarize this journal entry:\n\n${content}`,
        maxTokens: 150,
      });

      const summary = message.trim();
      return this.guardrails.sanitizeForDisplay(summary);
    } catch {
      return '';
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // SAFETY RESPONSE
  // ─────────────────────────────────────────────────────────────────────────

  async generateSafetyResponse(severity: string): Promise<string> {
    // For critical/high, always use deterministic rule-based response
    if (severity === 'critical' || severity === 'high') {
      return this.guardrails.getCrisisMessage(severity);
    }

    try {
      const message = await this.callClaude({
        system: `You are responding to someone who may be in emotional distress.
STRICT RULES:
- Never downplay their feelings
- Never say "everything will be fine" or give false reassurance
- Always point to crisis resources
- Use warm, present-tense language ("We're here with you")
- Keep response to 2-3 sentences, ≤80 words
- End with reference to 988 crisis line`,
        user: `Write a brief, caring support message for someone with ${severity} distress.`,
        maxTokens: 150,
      });

      const response = message.trim();
      return this.guardrails.isSafetyResponseSafe(response)
        ? response
        : this.guardrails.getCrisisMessage(severity);
    } catch {
      return this.guardrails.getCrisisMessage(severity);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // AI Q&A COMPANION
  // ─────────────────────────────────────────────────────────────────────────

  async answerUserQuestion(
    userId: string,
    question: string,
  ): Promise<{ answer: string; sources: string[] }> {
    const SAFE_FALLBACK = {
      answer:
        "I wasn't able to process your question right now. Try asking about your mood, sleep, or check-in patterns.",
      sources: [],
    };

    try {
      // Safety check on question
      if (this.guardrails.isQuestionUnsafe(question)) {
        return {
          answer:
            'That question is outside what I can help with here. If you need support, the 988 Suicide & Crisis Lifeline is available 24/7.',
          sources: ['988 Crisis Line'],
        };
      }

      const context = await this.buildUserContext(userId);

      const message = await this.callClaude({
        system: `You are a supportive wellness data assistant named MindPath AI.
Answer questions about the user's mental wellness data.
RULES:
- Be specific, warm, and brief (≤100 words)
- Only discuss what the data shows — never fabricate trends
- Never make clinical claims or diagnoses
- For serious mental health concerns, encourage speaking with a professional
- Decline to answer questions unrelated to personal wellness data
- Do not reproduce data raw — interpret it in plain language`,
        user: `User data context:\n${context}\n\nUser question: ${question}`,
        maxTokens: 350,
      });

      const answer = message.trim();
      return {
        answer: this.guardrails.sanitizeForDisplay(answer),
        sources: ['Your check-in history (last 14 days)'],
      };
    } catch (err) {
      this.logger.error('answerUserQuestion failed', err);
      return SAFE_FALLBACK;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CORRELATION EXPLANATION
  // ─────────────────────────────────────────────────────────────────────────

  async explainCorrelation(
    factorA: string,
    factorB: string,
    delta: number,
    direction: 'positive' | 'negative',
  ): Promise<string> {
    try {
      const message = await this.callClaude({
        system: `You are a wellness data analyst explaining a pattern in plain English.
Write exactly 1 sentence (≤25 words). Be specific, warm, no jargon.`,
        user: `Pattern: when ${factorA} is ${direction === 'positive' ? 'high' : 'low'}, ${factorB} is ${delta} points ${direction === 'positive' ? 'higher' : 'lower'}. Explain this to the user.`,
        maxTokens: 80,
      });
      return message.trim();
    } catch {
      return `Your ${factorA} appears to affect your ${factorB}.`;
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────

  private async callClaude({
    system,
    user,
    maxTokens,
  }: {
    system: string;
    user: string;
    maxTokens: number;
  }): Promise<string> {
    const response = await this.client.messages.create({
      model: this.MODEL,
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const block = response.content[0];
    return block.type === 'text' ? block.text : '';
  }

  private parseJSON<T>(text: string): T | null {
    try {
      // Strip markdown code fences if present
      const clean = text
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();
      return JSON.parse(clean) as T;
    } catch {
      // Try to extract JSON from surrounding text
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try { return JSON.parse(match[0]) as T; } catch { /* fall through */ }
      }
      this.logger.warn(`JSON parse failed: ${text.slice(0, 200)}`);
      return null;
    }
  }

  private async buildCheckInContext(userId: string, checkIn: DailyCheckIn) {
    const [yesterday, weekHistory] = await Promise.all([
      this.prisma.dailyCheckIn.findFirst({
        where: {
          userId,
          checkedInAt: {
            gte: subDays(new Date(), 2),
            lt: subDays(new Date(), 0),
          },
          id: { not: checkIn.id },
        },
      }),
      this.prisma.dailyCheckIn.findMany({
        where: { userId, checkedInAt: { gte: subDays(new Date(), 7) } },
        select: { mood: true, anxiety: true, overallScore: true },
      }),
    ]);

    const avg = (arr: number[]) =>
      arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : null;

    return {
      today: checkIn,
      yesterday,
      weekAvgMood: avg(weekHistory.map((c) => c.mood)),
      weekAvgAnxiety: avg(weekHistory.map((c) => c.anxiety)),
      weekAvgOverall: avg(weekHistory.map((c) => Math.round(c.overallScore))),
    };
  }

  private async buildUserContext(userId: string): Promise<string> {
    const checkIns = await this.prisma.dailyCheckIn.findMany({
      where: { userId, checkedInAt: { gte: subDays(new Date(), 14) } },
      orderBy: { checkedInAt: 'desc' },
      take: 14,
      select: { mood: true, anxiety: true, energy: true, overallScore: true, checkedInAt: true },
    });

    return checkIns
      .map(
        (c) =>
          `${c.checkedInAt.toISOString().split('T')[0]}: mood=${c.mood} anxiety=${c.anxiety} energy=${c.energy} overall=${Math.round(c.overallScore)}`,
      )
      .join('\n');
  }

  private async getMedicationAdherence(userId: string): Promise<number | null> {
    const weekAgo = subDays(new Date(), 7);
    const logs = await this.prisma.medicationLog.findMany({
      where: { medication: { userId }, scheduledAt: { gte: weekAgo } },
    });
    if (!logs.length) return null;
    const taken = logs.filter((l) => l.status === 'taken').length;
    return Math.round((taken / logs.length) * 100);
  }
}
