// src/modules/reflections/reflections.controller.ts
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
import { ReflectionsService } from './reflections.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, AuthUser } from '../../common/decorators/current-user.decorator';
import { CreateReflectionDto } from './dto/reflection.dto';

@ApiTags('reflections')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('reflections')
export class ReflectionsController {
  constructor(private readonly svc: ReflectionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a journal entry' })
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateReflectionDto) {
    return this.svc.create(u.id, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get journal history (paginated)' })
  getHistory(
    @CurrentUser() u: AuthUser,
    @Query('limit') limit = 20,
    @Query('offset') offset = 0,
  ) {
    return this.svc.getHistory(u.id, Number(limit), Number(offset));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single journal entry' })
  getOne(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.getOne(u.id, id);
  }

  @Post(':id/summarize')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate or refresh AI summary for an entry' })
  summarize(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.summarize(u.id, id);
  }

  @Post('preview-summary')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Preview AI summary before saving' })
  previewSummary(
    @CurrentUser() u: AuthUser,
    @Body() dto: Partial<CreateReflectionDto>,
  ) {
    return this.svc.previewSummary(dto);
  }
}
