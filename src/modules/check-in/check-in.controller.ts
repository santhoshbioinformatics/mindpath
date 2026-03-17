// src/modules/check-in/check-in.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CheckInService } from './check-in.service';
import { CreateCheckInDto } from './dto/check-in.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('check-ins')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('check-ins')
export class CheckInController {
  constructor(private readonly checkInService: CheckInService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit daily check-in' })
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateCheckInDto) {
    return this.checkInService.create(user.id, dto);
  }

  @Get('today')
  @ApiOperation({ summary: "Get today's check-in if it exists" })
  getToday(@CurrentUser() user: AuthUser) {
    return this.checkInService.getToday(user.id);
  }

  @Get('streak')
  @ApiOperation({ summary: 'Get current and longest check-in streak' })
  getStreak(@CurrentUser() user: AuthUser) {
    return this.checkInService.getStreak(user.id);
  }

  @Get()
  @ApiOperation({ summary: 'Get check-in history' })
  @ApiQuery({ name: 'from', required: false, type: String })
  @ApiQuery({ name: 'to', required: false, type: String })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getHistory(
    @CurrentUser() user: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: number,
  ) {
    return this.checkInService.getHistory(user.id, { from, to, limit });
  }

  @Get('summary')
  @ApiOperation({ summary: 'Get aggregated stats for a date range' })
  @ApiQuery({ name: 'days', required: false, type: Number })
  getSummary(
    @CurrentUser() user: AuthUser,
    @Query('days') days = 7,
  ) {
    return this.checkInService.getSummary(user.id, Number(days));
  }
}
