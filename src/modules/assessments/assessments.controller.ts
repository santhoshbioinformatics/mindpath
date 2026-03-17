// src/modules/assessments/assessments.controller.ts
import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AssessmentsService } from './assessments.service';
import { CreateAssessmentDto } from './dto/assessment.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('assessments')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('assessments')
export class AssessmentsController {
  constructor(private readonly svc: AssessmentsService) {}

  @Get('types')
  @ApiOperation({ summary: 'Get list of supported assessment types' })
  getTypes() {
    return this.svc.getTypes();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Submit a completed assessment' })
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateAssessmentDto) {
    return this.svc.create(u.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get assessment history' })
  getHistory(
    @CurrentUser() u: AuthUser,
    @Query('type') type?: string,
    @Query('limit') limit = 20,
  ) {
    return this.svc.getHistory(u.id, { type, limit: Number(limit) });
  }

  @Get('latest/:type')
  @ApiOperation({ summary: 'Get the most recent assessment of a given type' })
  getLatest(@CurrentUser() u: AuthUser, @Param('type') type: string) {
    return this.svc.getLatest(u.id, type);
  }

  @Get('trend/:type')
  @ApiOperation({ summary: 'Get score trend for a given assessment type' })
  getTrend(
    @CurrentUser() u: AuthUser,
    @Param('type') type: string,
    @Query('limit') limit = 8,
  ) {
    return this.svc.getTrend(u.id, type, Number(limit));
  }
}
