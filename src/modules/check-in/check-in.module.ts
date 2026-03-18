// src/modules/check-in/check-in.module.ts
import { Module } from '@nestjs/common';
import { AIModule } from '../../ai/ai.module';
import { NotificationsModule } from '../../notifications/notifications.module';
import { CheckInController } from './check-in.controller';
import { CheckInService } from './check-in.service';

@Module({
  imports: [AIModule, NotificationsModule],
  controllers: [CheckInController],
  providers: [CheckInService],
  exports: [CheckInService],
})
export class CheckInModule {}
