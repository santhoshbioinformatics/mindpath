// src/ai/ai.module.ts
import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { GuardrailsService } from './guardrails.service';
import { PromptBuilder } from './prompt-builder.service';

@Module({
  providers: [AIService, GuardrailsService, PromptBuilder],
  exports: [AIService, GuardrailsService],
})
export class AIModule {}
