// src/modules/onboarding/onboarding.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class OnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async setGoals(userId: string, goals: string[]) {
    await this.prisma.userProfile.update({
      where: { userId },
      data: { primaryGoals: goals },
    });
    return { success: true };
  }

  async setMission(userId: string, content: string) {
    await this.prisma.missionStatement.upsert({
      where: { userId },
      create: { userId, content },
      update: { content },
    });
    return { success: true };
  }

  async submitBaseline(userId: string, answers: Record<string, number>) {
    const values = Object.values(answers);
    const avgScore =
      values.length
        ? values.reduce((a, b) => a + b, 0) / values.length
        : 50;

    // Create an initial check-in from baseline answers so
    // the app has data to compare against from day one
    await this.prisma.dailyCheckIn.create({
      data: {
        userId,
        mood: answers['mood'] ?? 50,
        anxiety: answers['anxiety'] ?? 50,
        energy: answers['energy'] ?? 50,
        clarity: answers['clarity'] ?? 50,
        sleepQuality: answers['sleep'] ?? 50,
        stressTags: [],
        overallScore: Math.round(avgScore),
      },
    });

    await this.prisma.userProfile.update({
      where: { userId },
      data: { baselineDone: true },
    });

    return { success: true };
  }

  async complete(userId: string) {
    await this.prisma.userProfile.update({
      where: { userId },
      data: { onboardingDone: true },
    });
    return { success: true };
  }
}
