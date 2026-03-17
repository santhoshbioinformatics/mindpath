// src/modules/profile/profile.controller.ts
import {
  Controller,
  Get,
  Put,
  Post,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProfileService } from './profile.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import {
  UpdateProfileDto,
  CreateGoalDto,
  CreateTrustedContactDto,
  UpdateNotifPrefsDto,
} from './dto/profile.dto';

@ApiTags('profile')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly svc: ProfileService) {}

  // ── Profile ────────────────────────────────────────────────────────────────
  @Get()
  @ApiOperation({ summary: 'Get full profile with goals, mission, and prefs' })
  get(@CurrentUser() u: AuthUser) {
    return this.svc.get(u.id);
  }

  @Put()
  @ApiOperation({ summary: 'Update profile details' })
  update(@CurrentUser() u: AuthUser, @Body() dto: UpdateProfileDto) {
    return this.svc.update(u.id, dto);
  }

  // ── Goals ──────────────────────────────────────────────────────────────────
  @Get('goals')
  @ApiOperation({ summary: 'Get all active goals' })
  getGoals(@CurrentUser() u: AuthUser) {
    return this.svc.getGoals(u.id);
  }

  @Post('goals')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new goal' })
  createGoal(@CurrentUser() u: AuthUser, @Body() dto: CreateGoalDto) {
    return this.svc.createGoal(u.id, dto);
  }

  @Put('goals/:id')
  @ApiOperation({ summary: 'Update goal progress or details' })
  updateGoal(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: Partial<CreateGoalDto> & { progress?: number; isActive?: boolean },
  ) {
    return this.svc.updateGoal(u.id, id, dto);
  }

  @Delete('goals/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a goal' })
  deleteGoal(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.deleteGoal(u.id, id);
  }

  // ── Mission ────────────────────────────────────────────────────────────────
  @Get('mission')
  @ApiOperation({ summary: 'Get personal mission statement' })
  getMission(@CurrentUser() u: AuthUser) {
    return this.svc.getMission(u.id);
  }

  @Put('mission')
  @ApiOperation({ summary: 'Create or update personal mission statement' })
  upsertMission(
    @CurrentUser() u: AuthUser,
    @Body('content') content: string,
  ) {
    return this.svc.upsertMission(u.id, content);
  }

  // ── Trusted contacts ───────────────────────────────────────────────────────
  @Get('trusted-contacts')
  @ApiOperation({ summary: 'Get trusted contacts' })
  getContacts(@CurrentUser() u: AuthUser) {
    return this.svc.getContacts(u.id);
  }

  @Post('trusted-contacts')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a trusted contact' })
  createContact(
    @CurrentUser() u: AuthUser,
    @Body() dto: CreateTrustedContactDto,
  ) {
    return this.svc.createContact(u.id, dto);
  }

  @Delete('trusted-contacts/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove a trusted contact' })
  deleteContact(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.deleteContact(u.id, id);
  }

  // ── Notification preferences ───────────────────────────────────────────────
  @Get('notifications')
  @ApiOperation({ summary: 'Get notification preferences' })
  getNotifPrefs(@CurrentUser() u: AuthUser) {
    return this.svc.getNotifPrefs(u.id);
  }

  @Put('notifications')
  @ApiOperation({ summary: 'Update notification preferences' })
  updateNotifPrefs(
    @CurrentUser() u: AuthUser,
    @Body() dto: UpdateNotifPrefsDto,
  ) {
    return this.svc.updateNotifPrefs(u.id, dto);
  }

  // ── Alerts ─────────────────────────────────────────────────────────────────
  @Get('alerts')
  @ApiOperation({ summary: 'Get unacknowledged alerts' })
  getAlerts(@CurrentUser() u: AuthUser) {
    return this.svc.getAlerts(u.id);
  }

  @Put('alerts/:id/ack')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Acknowledge an alert' })
  ackAlert(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.ackAlert(u.id, id);
  }
}
