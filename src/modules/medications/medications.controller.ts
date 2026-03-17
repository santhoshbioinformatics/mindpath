// src/modules/medications/medications.controller.ts
import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { MedicationsService } from './medications.service';
import { CreateMedicationDto, LogMedicationDto } from './dto/medication.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';

@ApiTags('medications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('medications')
export class MedicationsController {
  constructor(private readonly svc: MedicationsService) {}

  @Get()
  @ApiOperation({ summary: 'Get all active medications' })
  getAll(@CurrentUser() u: AuthUser) {
    return this.svc.getAll(u.id);
  }

  @Get('today-status')
  @ApiOperation({ summary: "Get today's medication status for each medication" })
  getTodayStatus(@CurrentUser() u: AuthUser) {
    return this.svc.getTodayStatus(u.id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Add a new medication' })
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateMedicationDto) {
    return this.svc.create(u.id, dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update a medication' })
  update(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: Partial<CreateMedicationDto>,
  ) {
    return this.svc.update(u.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Deactivate a medication' })
  remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.remove(u.id, id);
  }

  @Post(':id/log')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Log a medication taken/skipped/snoozed' })
  log(
    @CurrentUser() u: AuthUser,
    @Param('id') id: string,
    @Body() dto: LogMedicationDto,
  ) {
    return this.svc.log(u.id, id, dto);
  }

  @Get(':id/adherence')
  @ApiOperation({ summary: 'Get 28-day adherence stats for a medication' })
  getAdherence(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.getAdherence(u.id, id);
  }
}
