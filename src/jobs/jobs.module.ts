// src/jobs/jobs.module.ts
import { Module } from '@nestjs/common';
import { CorrelationDetectionJob } from './correlation-detection.job';
import { WeeklyReportJob } from './weekly-report.job';
import { StreakManagementJob } from './streak-management.job';
import { MedicationReminderJob } from './medication-reminder.job';
import { AIModule } from '../ai/ai.module';

@Module({
  imports: [AIModule],
  providers: [
    CorrelationDetectionJob,
    WeeklyReportJob,
    StreakManagementJob,
    MedicationReminderJob,
  ],
  exports: [WeeklyReportJob, CorrelationDetectionJob],
})
export class JobsModule {}
