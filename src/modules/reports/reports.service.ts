// src/modules/reports/reports.service.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { WeeklyReportJob } from '../../jobs/weekly-report.job';
import { startOfWeek } from 'date-fns';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly weeklyJob: WeeklyReportJob,
  ) {}

  async getWeekly(userId: string) {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return this.prisma.weeklyReport.findFirst({
      where: { userId, weekStart: { gte: weekStart } },
      orderBy: { weekStart: 'desc' },
    });
  }

  async generateWeekly(userId: string) {
    return this.weeklyJob.generateForUser(userId);
  }

  async getMonthly(userId: string, month?: number, year?: number) {
    return this.prisma.monthlyReport.findFirst({
      where: {
        userId,
        month: month || new Date().getMonth() + 1,
        year: year || new Date().getFullYear(),
      },
    });
  }

  async getHistory(userId: string) {
    const [weekly, monthly] = await Promise.all([
      this.prisma.weeklyReport.findMany({
        where: { userId },
        orderBy: { weekStart: 'desc' },
        take: 12,
        select: {
          id: true,
          weekStart: true,
          weekEnd: true,
          metrics: true,
          highlights: true,
          createdAt: true,
        },
      }),
      this.prisma.monthlyReport.findMany({
        where: { userId },
        orderBy: [{ year: 'desc' }, { month: 'desc' }],
        take: 12,
        select: { id: true, month: true, year: true, metrics: true, createdAt: true },
      }),
    ]);
    return { weekly, monthly };
  }
}
