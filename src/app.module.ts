// src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { CheckInModule } from './modules/check-in/check-in.module';
import { InsightsModule } from './modules/insights/insights.module';
import { MedicationsModule } from './modules/medications/medications.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { ActivitiesModule } from './modules/activities/activities.module';
import { ReflectionsModule } from './modules/reflections/reflections.module';
import { SafetyModule } from './modules/safety/safety.module';
import { ReportsModule } from './modules/reports/reports.module';
import { ProfileModule } from './modules/profile/profile.module';
import { HealthModule } from './health/health.module';
import { AIModule } from './ai/ai.module';
import { JobsModule } from './jobs/jobs.module';
import { NotificationsModule } from './notifications/notifications.module';
import { validate } from './config/env.validation';

@Module({
  imports: [
    // ── Config ──────────────────────────────────────────────
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate,
      envFilePath: ['.env.local', '.env'],
    }),

    // ── Rate limiting ────────────────────────────────────────
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ([{
        ttl: config.get('THROTTLE_TTL', 60000),
        limit: config.get('THROTTLE_LIMIT', 60),
      }]),
    }),

    // ── Scheduled jobs ───────────────────────────────────────
    ScheduleModule.forRoot(),

    // ── Core infra ───────────────────────────────────────────
    PrismaModule,
    AIModule,
    NotificationsModule,
    JobsModule,

    // ── Feature modules ──────────────────────────────────────
    AuthModule,
    OnboardingModule,
    CheckInModule,
    InsightsModule,
    MedicationsModule,
    AssessmentsModule,
    ActivitiesModule,
    ReflectionsModule,
    SafetyModule,
    ReportsModule,
    ProfileModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
