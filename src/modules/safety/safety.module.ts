// src/modules/safety/safety.module.ts
import { Module } from '@nestjs/common';
import { SafetyController } from './safety.controller';
import { SafetyService } from './safety.service';
import { AIModule } from '../../ai/ai.module';

@Module({
  imports: [AIModule],
  controllers: [SafetyController],
  providers: [SafetyService],
})
export class SafetyModule {}
