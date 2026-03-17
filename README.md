# MindPath API — Backend Reference

NestJS + TypeScript + PostgreSQL + Prisma + Claude AI

---

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env
# Edit .env — minimum required: DATABASE_URL, JWT_SECRET, JWT_REFRESH_SECRET, ANTHROPIC_API_KEY

# 3. Start database (Docker)
docker-compose up postgres -d

# 4. Run migrations and generate Prisma client
npm run db:migrate:dev
npm run db:generate

# 5. Seed with demo data
npm run db:seed

# 6. Start development server
npm run start:dev

# API will be at: http://localhost:3000/api/v1
# Swagger docs: http://localhost:3000/api/docs
```

---

## Architecture

```
src/
├── main.ts                    Bootstrap, middleware, Swagger
├── app.module.ts              Root module — wires all features
├── config/
│   └── env.validation.ts      Zod schema for all env vars
├── prisma/
│   ├── prisma.module.ts        Global Prisma module
│   └── prisma.service.ts       Extends PrismaClient with lifecycle hooks
├── common/
│   ├── filters/                HttpExceptionFilter → consistent error shape
│   ├── interceptors/           TransformInterceptor, LoggingInterceptor
│   ├── decorators/             @CurrentUser(), @ApiPaginationQuery()
│   ├── guards/                 JwtAuthGuard
│   └── pipes/                  ParseDatePipe
├── ai/
│   ├── ai.module.ts
│   ├── ai.service.ts           Claude integration — all AI capabilities
│   ├── prompt-builder.service.ts  Structured prompt construction
│   └── guardrails.service.ts   Content safety, blocklists, fallbacks
├── notifications/
│   └── notifications.service.ts  Expo push, email, quiet hours
├── jobs/
│   ├── correlation-detection.job.ts  Nightly Pearson-r analysis
│   ├── weekly-report.job.ts    Sunday 6pm report generation
│   ├── streak-management.job.ts  11pm streak/re-engagement
│   └── medication-reminder.job.ts  Every 30min dose checks
└── modules/
    ├── auth/          JWT, magic links, push token registration
    ├── check-in/      Daily check-in, streak, safety detection
    ├── assessments/   9 assessment types, scoring engine, severity
    ├── insights/      Correlations, weekly/monthly reports, AI Q&A
    ├── medications/   CRUD, adherence analytics, dose logging
    ├── reflections/   Journal with AI summary
    ├── activities/    Activity logging
    ├── safety/        Columbia-style screening, escalation, crisis resources
    ├── reports/       On-demand report generation
    ├── profile/       Goals, mission, contacts, notification prefs
    └── onboarding/    Goals, baseline, mission setup
```

---

## API Reference

All endpoints require `Authorization: Bearer <token>` unless noted.
Base URL: `/api/v1`

### Auth

| Method | Path | Description |
|--------|------|-------------|
| POST | `/auth/register` | Create account → `{tokens, user, profile}` |
| POST | `/auth/login` | Email + password → `{tokens, user, profile}` |
| POST | `/auth/magic-link` | Request magic link email |
| GET | `/auth/magic-link/verify?token=` | Verify magic link → `{tokens, user, profile}` |
| POST | `/auth/refresh` | Refresh tokens `{refreshToken}` → `{accessToken, refreshToken}` |
| GET | `/auth/me` | Current user + fresh tokens |
| POST | `/auth/push-token` | Register Expo push token |
| POST | `/auth/logout` | Client-side token deletion |

### Check-ins

| Method | Path | Description |
|--------|------|-------------|
| POST | `/check-ins` | Submit daily check-in → `{checkIn, insight, streak}` |
| GET | `/check-ins/today` | Today's check-in or null |
| GET | `/check-ins/streak` | `{current, longest, lastCheckIn}` |
| GET | `/check-ins?from=&to=&limit=` | Check-in history |
| GET | `/check-ins/summary?days=7` | Aggregated stats |

**POST /check-ins body:**
```json
{
  "mood": 70,
  "anxiety": 35,
  "energy": 65,
  "clarity": 60,
  "sleepQuality": 55,
  "motivation": 70,
  "socialConnection": 50,
  "stressTags": ["work_pressure"],
  "notes": "Rough morning, better afternoon"
}
```

### Assessments

| Method | Path | Description |
|--------|------|-------------|
| GET | `/assessments/types` | All supported types |
| POST | `/assessments` | Submit assessment → `{response, severity, delta, maxScore}` |
| GET | `/assessments?type=&limit=` | Assessment history |
| GET | `/assessments/latest/:type` | Most recent of a type |
| GET | `/assessments/trend/:type?limit=8` | Score trend |

**Assessment types:** `mood` · `anxiety` · `stress` · `cognition` · `life_satisfaction` · `life_progress` · `pain` · `addiction` · `memory` · `suicidality`

### Medications

| Method | Path | Description |
|--------|------|-------------|
| GET | `/medications` | All active medications |
| GET | `/medications/today-status` | Status (due/taken/skipped) for each |
| POST | `/medications` | Add medication |
| PUT | `/medications/:id` | Update medication |
| DELETE | `/medications/:id` | Deactivate medication |
| POST | `/medications/:id/log` | Log taken/skipped/snoozed |
| GET | `/medications/:id/adherence` | 28-day adherence stats |

### Insights

| Method | Path | Description |
|--------|------|-------------|
| GET | `/insights?type=&limit=` | Recent insights |
| GET | `/insights/weekly` | Current week's report |
| GET | `/insights/monthly?month=&year=` | Monthly report |
| GET | `/insights/correlations` | Detected correlations |
| GET | `/insights/predictions` | Predictive signals |
| POST | `/insights/:id/read` | Mark as read |
| POST | `/insights/ask` | `{question}` → AI Q&A |
| POST | `/insights/refresh-correlations` | Trigger correlation detection |

### Profile

| Method | Path | Description |
|--------|------|-------------|
| GET | `/profile` | Profile + goals + mission + notif prefs |
| PUT | `/profile` | Update display name, timezone, goals |
| GET/POST/PUT/DELETE | `/profile/goals/:id` | Goal CRUD |
| GET/PUT | `/profile/mission` | Mission statement |
| GET/POST/DELETE | `/profile/trusted-contacts/:id` | Trusted contacts |
| GET/PUT | `/profile/notifications` | Notification preferences |
| GET | `/profile/alerts` | Unacknowledged alerts |
| PUT | `/profile/alerts/:id/ack` | Acknowledge alert |

### Safety

| Method | Path | Description |
|--------|------|-------------|
| GET | `/safety/resources` | Crisis line resources |
| POST | `/safety/screen` | `{answers}` → `{severity, resources, nextSteps, message}` |
| POST | `/safety/alert` | `{severity}` → Create safety alert |

### Reflections

| Method | Path | Description |
|--------|------|-------------|
| POST | `/reflections` | Create journal entry |
| GET | `/reflections?limit=&offset=` | Paginated history |
| GET | `/reflections/:id` | Single entry |
| POST | `/reflections/:id/summarize` | Generate/refresh AI summary |
| POST | `/reflections/preview-summary` | Preview AI summary without saving |

### Onboarding

| Method | Path | Description |
|--------|------|-------------|
| POST | `/onboarding/goals` | `{goals: string[]}` |
| POST | `/onboarding/mission` | `{content: string}` |
| POST | `/onboarding/baseline` | `{answers: Record<string, number>}` |
| POST | `/onboarding/complete` | Mark onboarding done |

---

## Scoring Engine

### Overall Wellbeing Score (daily check-in)
```
overall = (mood + energy + clarity + (100 - anxiety) + sleepQuality) / 5
```

### Assessment Severity Thresholds

| Type | None | Mild | Moderate | Severe |
|------|------|------|----------|--------|
| mood (higher = better) | ≥18 | 14–17 | 9–13 | 0–8 |
| anxiety | 0–4 | 5–9 | 10–14 | ≥15 |
| stress | 0–13 | 14–19 | 20–26 | ≥27 |
| suicidality | 0 | 1–2 | 3 | ≥4 |

### Correlation Detection (Pearson r)
- Strong: confidence ≥ 0.80
- Moderate: confidence 0.65–0.79
- Weak: confidence 0.55–0.64
- Minimum 3 data points required per factor group
- Minimum delta of 5–8 points required to surface as insight

---

## Safety Architecture

### Check-in safety triggers
- `mood ≤ 10` or `anxiety ≥ 95` → **Critical** alert + 24h follow-up notification
- `mood ≤ 20` or `anxiety ≥ 80` → **Warning** alert

### Suicidality screening escalation
- Score 0 (all no) → No action
- Score 1–2, no plan → Low severity, supportive message
- Score 3, no plan → Moderate, resources shown, alert created
- Score ≥ 4 OR plan present → Critical, resources shown prominently, alert created

### AI Guardrails
All AI output passes through `GuardrailsService` before storage or response:
1. Blocked phrase check (false reassurance, diagnostic language)
2. Safety response validation (must include crisis resource reference)
3. Sanitization (removes clinical labels, markdown artifacts)
4. Fallback: deterministic response if validation fails

**No AI model is used for safety classification decisions** — those are rule-based.

---

## Scheduled Jobs

| Job | Schedule | What it does |
|-----|----------|--------------|
| `CorrelationDetectionJob` | `0 3 * * *` (3am) | Pearson-r analysis on 30d data for all users |
| `WeeklyReportJob` | `0 18 * * 0` (Sun 6pm) | AI narrative + metrics for all users |
| `StreakManagementJob` | `0 23 * * *` (11pm) | Reset broken streaks, send re-engagement |
| `MedicationReminderJob` | `*/30 * * * *` (every 30m) | Check overdue doses, send push |

---

## Running Tests

```bash
npm test                 # Unit tests
npm run test:cov         # With coverage report
npm run test:e2e         # End-to-end tests
```

---

## Production Deployment (Railway / Render / Fly.io)

```bash
# Build
npm run build

# Set env vars in your platform dashboard
# Then run migrations (run once or in deploy hook)
npx prisma migrate deploy

# Start
node dist/main
```

Recommended: Set `DATABASE_URL` to a connection pooler (PgBouncer or Supabase pooler) for production.
