// src/modules/reports/reports.controller.ts
import {
  Controller,
  Post,
  Get,
  UseGuards,
  HttpCode,
  HttpStatus,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ReportsService } from './reports.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('reports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reports')
export class ReportsController {
  constructor(private readonly svc: ReportsService) {}

  @Get('weekly')
  @ApiOperation({ summary: 'Get the current weekly report' })
  getWeekly(@CurrentUser() u: AuthUser) {
    return this.svc.getWeekly(u.id);
  }

  @Post('weekly/generate')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger weekly report generation on demand' })
  generateWeekly(@CurrentUser() u: AuthUser) {
    return this.svc.generateWeekly(u.id);
  }

  @Get('monthly')
  @ApiOperation({ summary: 'Get a monthly report' })
  @ApiQuery({ name: 'month', required: false, type: Number })
  @ApiQuery({ name: 'year', required: false, type: Number })
  getMonthly(
    @CurrentUser() u: AuthUser,
    @Query('month') month?: number,
    @Query('year') year?: number,
  ) {
    return this.svc.getMonthly(u.id, Number(month), Number(year));
  }

  @Get('history')
  @ApiOperation({ summary: 'Get list of all past weekly and monthly reports' })
  getHistory(@CurrentUser() u: AuthUser) {
    return this.svc.getHistory(u.id);
  }
}
