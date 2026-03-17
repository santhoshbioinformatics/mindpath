// src/modules/activities/activities.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateActivityDto } from './dto/activity.dto';
import { subDays } from 'date-fns';
import type { ActivityType } from '@prisma/client';

@Injectable()
export class ActivitiesService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateActivityDto) {
    const activity = await this.prisma.activityLog.create({
      data: {
        userId,
        type: dto.type as ActivityType,
        name: dto.name,
        durationMins: dto.durationMins,
        intensity: dto.intensity,
        notes: dto.notes,
      },
    });
    return { activity };
  }

  async getHistory(userId: string, opts: { from?: string; to?: string }) {
    const activities = await this.prisma.activityLog.findMany({
      where: {
        userId,
        loggedAt: {
          gte: opts.from ? new Date(opts.from) : subDays(new Date(), 30),
          lte: opts.to ? new Date(opts.to) : new Date(),
        },
      },
      orderBy: { loggedAt: 'desc' },
      take: 100,
    });
    return { activities };
  }

  async remove(userId: string, id: string) {
    const activity = await this.prisma.activityLog.findUnique({
      where: { id },
    });
    if (!activity) throw new NotFoundException('Activity not found.');
    if (activity.userId !== userId) throw new ForbiddenException();
    await this.prisma.activityLog.delete({ where: { id } });
  }
}
