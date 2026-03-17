// src/modules/insights/insights.module.ts
import { Module } from '@nestjs/common';
import { InsightsController } from './insights.controller';
import { InsightsService } from './insights.service';
import { CorrelationDetectionJob } from '../../jobs/correlation-detection.job';

@Module({
  controllers: [InsightsController],
  providers: [InsightsService, CorrelationDetectionJob],
  exports: [InsightsService],
})
export class InsightsModule {}
