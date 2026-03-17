// src/modules/reflections/reflections.module.ts
import { Module } from '@nestjs/common';
import { ReflectionsController } from './reflections.controller';
import { ReflectionsService } from './reflections.service';

@Module({
  controllers: [ReflectionsController],
  providers: [ReflectionsService],
})
export class ReflectionsModule {}
