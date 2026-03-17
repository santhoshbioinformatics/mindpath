// src/modules/insights/insights.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService } from '../../ai/ai.service';
import { CorrelationDetectionJob } from '../../jobs/correlation-detection.job';
import { startOfWeek } from 'date-fns';
import type { InsightType } from '@prisma/client';

@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIService,
    private readonly correlationJob: CorrelationDetectionJob,
  ) {}

  async getRecent(userId: string, opts: { type?: string; limit: number }) {
    const insights = await this.prisma.insight.findMany({
      where: {
        userId,
        ...(opts.type ? { type: opts.type as InsightType } : {}),
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { generatedAt: 'desc' },
      take: opts.limit,
    });
    return { insights };
  }

  async getWeekly(userId: string) {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return this.prisma.weeklyReport.findFirst({
      where: { userId, weekStart: { gte: weekStart } },
      orderBy: { weekStart: 'desc' },
    });
  }

  async getMonthly(userId: string, opts: { month?: number; year?: number }) {
    const month = opts.month ?? new Date().getMonth() + 1;
    const year = opts.year ?? new Date().getFullYear();
    return this.prisma.monthlyReport.findFirst({
      where: { userId, month, year },
    });
  }

  async getCorrelations(userId: string) {
    const insights = await this.prisma.insight.findMany({
      where: {
        userId,
        type: 'correlation',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { confidence: 'desc' },
      take: 8,
    });

    return {
      correlations: insights.map((ins) => {
        const data = (ins.supportingData ?? {}) as Record<string, unknown>;
        return {
          id: ins.id,
          title: ins.title,
          description: ins.body,
          strength: this.confidenceToStrength(ins.confidence ?? 0),
          confidence: ins.confidence ?? 0,
          factorA: (data.factorA as string) ?? '',
          factorB: (data.factorB as string) ?? '',
          direction: 'positive' as const,
          suggestedAction: ins.suggestedAction,
          supportingData: data,
        };
      }),
    };
  }

  async getPredictions(userId: string) {
    const predictions = await this.prisma.insight.findMany({
      where: {
        userId,
        type: 'prediction',
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
      orderBy: { generatedAt: 'desc' },
      take: 5,
    });
    return { predictions };
  }

  async markRead(userId: string, insightId: string) {
    await this.prisma.insight.updateMany({
      where: { id: insightId, userId },
      data: { isRead: true },
    });
    return { success: true };
  }

  async askAI(userId: string, question: string) {
    if (!question?.trim()) {
      return { answer: 'Please ask a question.', sources: [] };
    }
    return this.ai.answerUserQuestion(userId, question.trim());
  }

  async refreshCorrelations(userId: string) {
    await this.correlationJob.detectForUser(userId);
    return { success: true };
  }

  private confidenceToStrength(confidence: number): 'strong' | 'moderate' | 'weak' {
    if (confidence >= 0.8) return 'strong';
    if (confidence >= 0.65) return 'moderate';
    return 'weak';
  }
}
