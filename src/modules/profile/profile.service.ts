// src/modules/profile/profile.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  UpdateProfileDto,
  CreateGoalDto,
  CreateTrustedContactDto,
  UpdateNotifPrefsDto,
} from './dto/profile.dto';
import type { GoalCategory } from '@prisma/client';

@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

  async get(userId: string) {
    const [profile, goals, mission, notifPrefs] = await Promise.all([
      this.prisma.userProfile.findUnique({ where: { userId } }),
      this.prisma.goal.findMany({
        where: { userId, isActive: true },
        orderBy: { createdAt: 'asc' },
      }),
      this.prisma.missionStatement.findUnique({ where: { userId } }),
      this.prisma.notificationPreference.findUnique({ where: { userId } }),
    ]);
    if (!profile) throw new NotFoundException('Profile not found.');
    return { profile, goals, mission, notifPrefs };
  }

  async update(userId: string, dto: UpdateProfileDto) {
    const profile = await this.prisma.userProfile.update({
      where: { userId },
      data: {
        displayName: dto.displayName,
        timezone: dto.timezone,
        primaryGoals: dto.primaryGoals,
      },
    });
    return { profile };
  }

  async getGoals(userId: string) {
    const goals = await this.prisma.goal.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'asc' },
    });
    return { goals };
  }

  async createGoal(userId: string, dto: CreateGoalDto) {
    const goal = await this.prisma.goal.create({
      data: {
        userId,
        title: dto.title,
        description: dto.description,
        category: dto.category as GoalCategory,
        targetDate: dto.targetDate ? new Date(dto.targetDate) : undefined,
      },
    });
    return { goal };
  }

  async updateGoal(
    userId: string,
    id: string,
    dto: Partial<CreateGoalDto> & { progress?: number; isActive?: boolean },
  ) {
    await this.prisma.goal.updateMany({
      where: { id, userId },
      data: {
        title: dto.title,
        progress: dto.progress,
        isActive: dto.isActive,
      },
    });
    return { success: true };
  }

  async deleteGoal(userId: string, id: string) {
    await this.prisma.goal.updateMany({
      where: { id, userId },
      data: { isActive: false },
    });
  }

  async getMission(userId: string) {
    const mission = await this.prisma.missionStatement.findUnique({
      where: { userId },
    });
    return { mission };
  }

  async upsertMission(userId: string, content: string) {
    const mission = await this.prisma.missionStatement.upsert({
      where: { userId },
      create: { userId, content },
      update: { content },
    });
    return { mission };
  }

  async getContacts(userId: string) {
    const contacts = await this.prisma.trustedContact.findMany({
      where: { userId },
      orderBy: { isPrimary: 'desc' },
    });
    return { contacts };
  }

  async createContact(userId: string, dto: CreateTrustedContactDto) {
    const contact = await this.prisma.trustedContact.create({
      data: {
        userId,
        name: dto.name,
        relation: dto.relation,
        phone: dto.phone,
        email: dto.email,
        isPrimary: dto.isPrimary ?? false,
      },
    });
    return { contact };
  }

  async deleteContact(userId: string, id: string) {
    await this.prisma.trustedContact.deleteMany({ where: { id, userId } });
  }

  async getNotifPrefs(userId: string) {
    const prefs = await this.prisma.notificationPreference.findUnique({
      where: { userId },
    });
    return { prefs };
  }

  async updateNotifPrefs(userId: string, dto: UpdateNotifPrefsDto) {
    const prefs = await this.prisma.notificationPreference.upsert({
      where: { userId },
      create: {
        userId,
        checkInTime: dto.checkInTime ?? '08:00',
        checkInEnabled: dto.checkInEnabled ?? true,
        medicationEnabled: dto.medicationEnabled ?? true,
        weeklyReportEnabled: dto.weeklyReportEnabled ?? true,
        streakEnabled: dto.streakEnabled ?? true,
        quietHoursStart: dto.quietHoursStart,
        quietHoursEnd: dto.quietHoursEnd,
      },
      update: {
        checkInTime: dto.checkInTime,
        checkInEnabled: dto.checkInEnabled,
        medicationEnabled: dto.medicationEnabled,
        weeklyReportEnabled: dto.weeklyReportEnabled,
        streakEnabled: dto.streakEnabled,
        quietHoursStart: dto.quietHoursStart,
        quietHoursEnd: dto.quietHoursEnd,
      },
    });
    return { prefs };
  }

  async getAlerts(userId: string) {
    const alerts = await this.prisma.alert.findMany({
      where: { userId, isAcked: false },
      orderBy: { triggeredAt: 'desc' },
      take: 20,
    });
    return { alerts };
  }

  async ackAlert(userId: string, id: string) {
    await this.prisma.alert.updateMany({
      where: { id, userId },
      data: { isAcked: true, ackedAt: new Date() },
    });
    return { success: true };
  }
}
