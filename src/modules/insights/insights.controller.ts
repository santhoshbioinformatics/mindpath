// src/modules/insights/insights.controller.ts
import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InsightsService } from './insights.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('insights')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('insights')
export class InsightsController {
  constructor(private readonly svc: InsightsService) {}

  @Get()
  @ApiOperation({ summary: 'Get recent insights' })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'limit', required: false })
  getRecent(
    @CurrentUser() u: AuthUser,
    @Query('type') type?: string,
    @Query('limit') limit = 10,
  ) {
    return this.svc.getRecent(u.id, { type, limit: Number(limit) });
  }

  @Get('weekly')
  @ApiOperation({ summary: 'Get current weekly report' })
  getWeekly(@CurrentUser() u: AuthUser) {
    return this.svc.getWeekly(u.id);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Get monthly report' })
  @ApiQuery({ name: 'month', required: false })
  @ApiQuery({ name: 'year', required: false })
  getMonthly(
    @CurrentUser() u: AuthUser,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.svc.getMonthly(u.id, {
      month: month ? Number(month) : undefined,
      year: year ? Number(year) : undefined,
    });
  }

  @Get('correlations')
  @ApiOperation({ summary: 'Get detected correlations' })
  getCorrelations(@CurrentUser() u: AuthUser) {
    return this.svc.getCorrelations(u.id);
  }

  @Get('predictions')
  @ApiOperation({ summary: 'Get predictive signals' })
  getPredictions(@CurrentUser() u: AuthUser) {
    return this.svc.getPredictions(u.id);
  }

  @Post(':id/read')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mark an insight as read' })
  markRead(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.markRead(u.id, id);
  }

  @Post('ask')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Ask the AI a question about your wellness data' })
  ask(@CurrentUser() u: AuthUser, @Body('question') question: string) {
    return this.svc.askAI(u.id, question);
  }

  @Post('refresh-correlations')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger correlation detection on demand' })
  refreshCorrelations(@CurrentUser() u: AuthUser) {
    return this.svc.refreshCorrelations(u.id);
  }
}
