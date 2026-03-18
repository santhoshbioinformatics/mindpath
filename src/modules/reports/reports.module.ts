// src/modules/reports/reports.module.ts
import { Module } from '@nestjs/common';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { WeeklyReportJob } from '../../jobs/weekly-report.job';
import { AIModule } from '../../ai/ai.module';
import { NotificationsModule } from '../../notifications/notifications.module';

@Module({
  imports: [AIModule, NotificationsModule],
  controllers: [ReportsController],
  providers: [ReportsService, WeeklyReportJob],
})
export class ReportsModule {}
