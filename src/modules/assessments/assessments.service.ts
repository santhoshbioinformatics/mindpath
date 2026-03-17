// src/modules/assessments/assessments.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { CreateAssessmentDto } from './dto/assessment.dto';
import type { AssessmentType, SeverityLevel } from '@prisma/client';

interface ScoringConfig {
  maxPerQ: number;
  reversedIds: string[];
  severityThresholds: { none: number; mild: number; moderate: number; severe: number };
  higherIsBetter: boolean;
  safetyThreshold?: number;
}

const SCORING: Record<string, ScoringConfig> = {
  mood: {
    maxPerQ: 4,
    reversedIds: ['m2'],
    severityThresholds: { none: 18, mild: 14, moderate: 9, severe: 0 },
    higherIsBetter: true,
  },
  anxiety: {
    maxPerQ: 3,
    reversedIds: [],
    severityThresholds: { none: 0, mild: 5, moderate: 10, severe: 15 },
    higherIsBetter: false,
    safetyThreshold: 15,
  },
  stress: {
    maxPerQ: 4,
    reversedIds: ['s4', 's5', 's6', 's7'],
    severityThresholds: { none: 0, mild: 14, moderate: 20, severe: 27 },
    higherIsBetter: false,
  },
  cognition: {
    maxPerQ: 4,
    reversedIds: ['c4', 'c5'],
    severityThresholds: { none: 18, mild: 14, moderate: 9, severe: 0 },
    higherIsBetter: true,
  },
  life_satisfaction: {
    maxPerQ: 4,
    reversedIds: [],
    severityThresholds: { none: 18, mild: 14, moderate: 9, severe: 0 },
    higherIsBetter: true,
  },
  life_progress: {
    maxPerQ: 4,
    reversedIds: [],
    severityThresholds: { none: 18, mild: 14, moderate: 9, severe: 0 },
    higherIsBetter: true,
  },
  pain: {
    maxPerQ: 3,
    reversedIds: [],
    severityThresholds: { none: 0, mild: 4, moderate: 8, severe: 11 },
    higherIsBetter: false,
  },
  addiction: {
    maxPerQ: 4,
    reversedIds: ['ad4'],
    severityThresholds: { none: 0, mild: 8, moderate: 14, severe: 19 },
    higherIsBetter: false,
    safetyThreshold: 18,
  },
  memory: {
    maxPerQ: 4,
    reversedIds: [],
    severityThresholds: { none: 0, mild: 5, moderate: 10, severe: 15 },
    higherIsBetter: false,
  },
  suicidality: {
    maxPerQ: 1,
    reversedIds: [],
    severityThresholds: { none: 0, mild: 1, moderate: 3, severe: 4 },
    higherIsBetter: false,
    safetyThreshold: 1,
  },
};

const ASSESSMENT_LABELS: Record<string, string> = {
  mood: 'Mood',
  anxiety: 'Anxiety Check',
  stress: 'Stress Level',
  cognition: 'Mental Clarity',
  life_satisfaction: 'Life Satisfaction',
  life_progress: 'Life Progress',
  pain: 'Pain Check-in',
  addiction: 'Craving & Urge Check',
  memory: 'Memory Check',
  suicidality: 'Wellbeing Screening',
};

@Injectable()
export class AssessmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  getTypes() {
    return {
      types: Object.keys(SCORING).map((type) => ({
        type,
        label: ASSESSMENT_LABELS[type] ?? type,
        hasSafetyThreshold: !!SCORING[type].safetyThreshold,
      })),
    };
  }

  async create(userId: string, dto: CreateAssessmentDto) {
    const config = SCORING[dto.assessmentType];
    if (!config) {
      throw new BadRequestException(`Unknown assessment type: ${dto.assessmentType}`);
    }

    const totalScore = this.computeScore(dto.rawAnswers, config);
    const severity = this.computeSeverity(totalScore, config) as SeverityLevel;
    const flaggedForReview =
      severity === 'severe' || dto.assessmentType === 'suicidality';

    const [response, prevResponse] = await Promise.all([
      this.prisma.assessmentResponse.create({
        data: {
          userId,
          assessmentType: dto.assessmentType as AssessmentType,
          rawAnswers: dto.rawAnswers,
          totalScore,
          severity,
          comments: dto.comments,
          flaggedForReview,
        },
      }),
      this.prisma.assessmentResponse.findFirst({
        where: {
          userId,
          assessmentType: dto.assessmentType as AssessmentType,
        },
        orderBy: { completedAt: 'desc' },
      }),
    ]);

    const delta =
      prevResponse
        ? Math.round(totalScore - prevResponse.totalScore)
        : null;

    if (flaggedForReview) {
      await this.createSafetyAlert(
        userId,
        dto.assessmentType,
        severity,
        totalScore,
      );
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'assessment_completed',
        metadata: {
          assessmentType: dto.assessmentType,
          severity,
          totalScore,
          flaggedForReview,
          delta,
        },
      },
    });

    return {
      response,
      severity,
      totalScore,
      delta,
      maxScore: Object.keys(dto.rawAnswers).length * config.maxPerQ,
      flaggedForReview,
    };
  }

  async getHistory(userId: string, opts: { type?: string; limit: number }) {
    const responses = await this.prisma.assessmentResponse.findMany({
      where: {
        userId,
        ...(opts.type ? { assessmentType: opts.type as AssessmentType } : {}),
      },
      orderBy: { completedAt: 'desc' },
      take: opts.limit,
    });
    return { responses };
  }

  async getLatest(userId: string, type: string) {
    const response = await this.prisma.assessmentResponse.findFirst({
      where: { userId, assessmentType: type as AssessmentType },
      orderBy: { completedAt: 'desc' },
    });
    return { response };
  }

  async getTrend(userId: string, type: string, limit: number) {
    const responses = await this.prisma.assessmentResponse.findMany({
      where: { userId, assessmentType: type as AssessmentType },
      orderBy: { completedAt: 'desc' },
      take: limit,
      select: { totalScore: true, severity: true, completedAt: true },
    });
    return { trend: responses.reverse() };
  }

  private computeScore(
    answers: Record<string, number>,
    config: ScoringConfig,
  ): number {
    return Object.entries(answers).reduce((total, [id, raw]) => {
      const val = config.reversedIds.includes(id)
        ? config.maxPerQ - raw
        : raw;
      return total + val;
    }, 0);
  }

  private computeSeverity(score: number, config: ScoringConfig): string {
    const { none, mild, moderate, severe } = config.severityThresholds;

    if (config.higherIsBetter) {
      if (score >= none) return 'none';
      if (score >= mild) return 'mild';
      if (score >= moderate) return 'moderate';
      return 'severe';
    } else {
      if (score >= severe) return 'severe';
      if (score >= moderate) return 'moderate';
      if (score >= mild) return 'mild';
      return 'none';
    }
  }

  private async createSafetyAlert(
    userId: string,
    type: string,
    severity: string,
    score: number,
  ): Promise<void> {
    const isCrisis = type === 'suicidality' && score >= 3;
    await this.prisma.alert.create({
      data: {
        userId,
        type: 'safety',
        severity: isCrisis ? 'critical' : 'warning',
        title: isCrisis
          ? "We want to make sure you're supported"
          : `${ASSESSMENT_LABELS[type] ?? type} flagged for review`,
        body: isCrisis
          ? 'Your screening responses suggest you may be going through a very difficult time. Please reach out — 988 is available 24/7.'
          : `Your ${ASSESSMENT_LABELS[type] ?? type} score (${score}) suggests you may benefit from additional support.`,
      },
    });
  }
}
