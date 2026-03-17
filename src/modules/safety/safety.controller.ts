// src/modules/safety/safety.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { SafetyService } from './safety.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('safety')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('safety')
export class SafetyController {
  constructor(private readonly svc: SafetyService) {}

  @Get('resources')
  @ApiOperation({ summary: 'Get crisis line resources' })
  getResources() {
    return this.svc.getResources();
  }

  @Post('screen')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit suicidality screening answers' })
  screen(
    @CurrentUser() u: AuthUser,
    @Body('answers') answers: Record<string, number>,
  ) {
    return this.svc.screen(u.id, answers);
  }

  @Post('alert')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Create a safety alert manually' })
  createAlert(
    @CurrentUser() u: AuthUser,
    @Body('severity') severity: string,
  ) {
    return this.svc.createAlert(u.id, severity);
  }
}
