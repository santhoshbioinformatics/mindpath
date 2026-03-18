// src/modules/reflections/reflections.module.ts
import { Module } from '@nestjs/common';
import { ReflectionsController } from './reflections.controller';
import { ReflectionsService } from './reflections.service';
import { AIModule } from '../../ai/ai.module';

@Module({
  imports: [AIModule],
  controllers: [ReflectionsController],
  providers: [ReflectionsService],
})
export class ReflectionsModule {}
