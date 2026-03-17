// src/modules/safety/safety.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GuardrailsService } from '../../ai/guardrails.service';
import type { SeverityLevel } from '@prisma/client';

const CRISIS_RESOURCES = [
  {
    name: '988 Suicide & Crisis Lifeline',
    description: 'Free, confidential support 24/7',
    contact: '988',
    method: 'call',
    available: 'Call or text 988 · Available 24/7',
  },
  {
    name: 'Crisis Text Line',
    description: 'Text-based crisis support',
    contact: '741741',
    method: 'text',
    available: 'Text HOME to 741741 · Available 24/7',
  },
  {
    name: 'International Crisis Lines',
    description: 'Find support in your country',
    contact: 'https://findahelpline.com',
    method: 'web',
    available: 'findahelpline.com',
  },
  {
    name: 'SAMHSA National Helpline',
    description: 'Mental health and substance use support',
    contact: '1-800-662-4357',
    method: 'call',
    available: 'Call · 24/7 · Free · Confidential',
  },
];

@Injectable()
export class SafetyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly guardrails: GuardrailsService,
  ) {}

  getResources() {
    return { resources: CRISIS_RESOURCES };
  }

  async screen(userId: string, answers: Record<string, number>) {
    const score = Object.values(answers).reduce(
      (s, v) => s + (v > 0 ? 1 : 0),
      0,
    );
    const hasPlan = (answers['su4'] ?? 0) > 0 || (answers['su5'] ?? 0) > 0;

    let severity: string;
    let requiresEscalation = false;

    if (score === 0) {
      severity = 'none';
    } else if (score <= 2 && !hasPlan) {
      severity = 'low';
    } else if (score <= 3 && !hasPlan) {
      severity = 'moderate';
      requiresEscalation = true;
    } else {
      severity = hasPlan ? 'critical' : 'high';
      requiresEscalation = true;
    }

    // Persist the screening result
    await this.prisma.assessmentResponse.create({
      data: {
        userId,
        assessmentType: 'suicidality',
        rawAnswers: answers,
        totalScore: score,
        severity: this.mapSeverity(severity) as SeverityLevel,
        flaggedForReview: requiresEscalation,
      },
    });

    if (requiresEscalation) {
      await this.createAlert(userId, severity);
    }

    await this.prisma.auditLog.create({
      data: {
        userId,
        action: 'suicidality_screening',
        metadata: { severity, score, requiresEscalation },
      },
    });

    return {
      severity,
      resources: CRISIS_RESOURCES,
      nextSteps: this.getNextSteps(severity),
      message: this.guardrails.getCrisisMessage(severity),
      requiresEscalation,
    };
  }

  async createAlert(userId: string, severity: string) {
    const isCritical = ['critical', 'high'].includes(severity);
    await this.prisma.alert.create({
      data: {
        userId,
        type: 'safety',
        severity: isCritical ? 'critical' : 'warning',
        title: 'Support resources are available',
        body: this.guardrails.getCrisisMessage(severity),
      },
    });
    return { success: true };
  }

  private getNextSteps(severity: string): string[] {
    if (severity === 'critical' || severity === 'high') {
      return [
        'Call or text 988 right now',
        'Tell someone you trust how you are feeling',
        'If in immediate danger, call 911',
        'Go to your nearest emergency room if needed',
      ];
    }
    if (severity === 'moderate') {
      return [
        'Reach out to a trusted person today',
        'Consider calling 988 to talk with someone',
        'Schedule time with a mental health professional',
      ];
    }
    return [
      'Continue your regular check-ins',
      'Talk to someone you trust',
      'Try the grounding exercises in the Support section',
    ];
  }

  private mapSeverity(s: string): string {
    const map: Record<string, string> = {
      none: 'none',
      low: 'mild',
      moderate: 'moderate',
      high: 'severe',
      critical: 'severe',
    };
    return map[s] ?? 'none';
  }
}
