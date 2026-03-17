// src/modules/onboarding/onboarding.controller.ts
import {
  Controller,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OnboardingService } from './onboarding.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('onboarding')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('onboarding')
export class OnboardingController {
  constructor(private readonly svc: OnboardingService) {}

  @Post('goals')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save selected goals during onboarding' })
  setGoals(
    @CurrentUser() u: AuthUser,
    @Body('goals') goals: string[],
  ) {
    return this.svc.setGoals(u.id, goals);
  }

  @Post('mission')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Save personal mission statement during onboarding' })
  setMission(
    @CurrentUser() u: AuthUser,
    @Body('content') content: string,
  ) {
    return this.svc.setMission(u.id, content);
  }

  @Post('baseline')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit baseline assessment answers' })
  submitBaseline(
    @CurrentUser() u: AuthUser,
    @Body() dto: { answers: Record<string, number> },
  ) {
    return this.svc.submitBaseline(u.id, dto.answers);
  }

  @Post('complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark onboarding as complete' })
  complete(@CurrentUser() u: AuthUser) {
    return this.svc.complete(u.id);
  }
}
