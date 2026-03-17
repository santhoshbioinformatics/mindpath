// src/modules/activities/activities.controller.ts
import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ActivitiesService } from './activities.service';
import { CreateActivityDto } from './dto/activity.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('activities')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('activities')
export class ActivitiesController {
  constructor(private readonly svc: ActivitiesService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log an activity' })
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateActivityDto) {
    return this.svc.create(u.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get activity history' })
  getHistory(
    @CurrentUser() u: AuthUser,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.getHistory(u.id, { from, to });
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an activity log' })
  remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.remove(u.id, id);
  }
}
