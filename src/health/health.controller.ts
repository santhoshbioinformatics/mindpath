// src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Health check — used by Render and monitoring' })
  async check() {
    const dbOk = await this.prisma.healthCheck();

    return {
      status: dbOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
      version: process.env.npm_package_version ?? '1.0.0',
      environment: process.env.NODE_ENV,
      services: {
        database: dbOk ? 'connected' : 'unavailable',
      },
    };
  }
}
