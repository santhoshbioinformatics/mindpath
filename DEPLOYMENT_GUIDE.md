# MindPath — Complete Free Deployment Guide

> From zero to live: GitHub → Neon (database) → Render (backend) → Expo (mobile app)
> **Cost: $0/month**

---

## Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                       Free Stack                                │
│                                                                 │
│  Your Mac/PC                                                    │
│      │                                                          │
│      ├─── git push ──► GitHub Repo                             │
│                            │                                    │
│                            ├─► GitHub Actions (CI/CD)          │
│                            │         │                          │
│                            │         ▼                          │
│                            │    Render (backend API)           │
│                            │         │                          │
│                            │         ▼                          │
│                            │    Neon Postgres (database)       │
│                            │                                    │
│                            └─► Expo EAS (mobile app builds)   │
│                                      │                          │
│                                      ▼                          │
│                              Expo Go / TestFlight / Play Store  │
└─────────────────────────────────────────────────────────────────┘
```

**Free tier limits you need to know:**
- **Render free**: Your backend sleeps after 15 minutes of no traffic. First request after sleep takes ~30 seconds to wake up. Upgrade to $7/mo Starter plan to avoid this.
- **Neon free**: 512 MB storage, 1 database, unlimited requests — plenty for development and early users.
- **Expo free**: Unlimited Expo Go testing, 30 EAS builds/month (Android + iOS).
- **GitHub free**: Unlimited public repos, 2000 CI/CD minutes/month.

---

## STEP 1 — Create Your GitHub Repository

### 1a. Create the repository on GitHub

1. Go to **https://github.com/new**
2. Fill in:
   - **Repository name:** `mindpath` (or any name you choose)
   - **Visibility:** Private ✓ (keeps your API keys hidden)
   - **Initialize:** Check "Add a README file"
3. Click **Create repository**

### 1b. Set up the monorepo folder structure

Your project should look like this before pushing:

```
mindpath/                          ← root of your repo
├── .github/
│   └── workflows/
│       ├── backend-deploy.yml     ← CI/CD for backend
│       └── mobile-ci.yml         ← CI for mobile
├── app/                           ← Expo Router screens
│   ├── (auth)/
│   ├── (onboarding)/
│   ├── (tabs)/
│   ├── assessments/
│   ├── journal/
│   ├── reports/
│   └── safety/
├── src/                           ← Mobile app source
│   ├── components/
│   ├── hooks/
│   ├── services/
│   ├── stores/
│   ├── lib/
│   ├── types/
│   └── constants/
├── backend/                       ← NestJS API
│   ├── src/
│   │   ├── modules/
│   │   ├── ai/
│   │   ├── jobs/
│   │   ├── notifications/
│   │   └── prisma/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── seed.ts
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── .gitignore
├── app.json                       ← Expo config
├── eas.json                       ← EAS build config
├── package.json                   ← Mobile app dependencies
├── tsconfig.json
└── render.yaml                    ← Render deployment config
```

---

## STEP 2 — Push Your Project to GitHub

Open your terminal and run these commands **one at a time**:

```bash
# 2a. Go into your project folder (wherever your code is)
cd /path/to/your/mindpath-project

# 2b. Initialize git (skip if already a git repo)
git init

# 2c. Connect to your GitHub repository
#     Replace YOUR_USERNAME with your actual GitHub username
git remote add origin https://github.com/YOUR_USERNAME/mindpath.git

# 2d. Check that .gitignore is in place (so you don't push secrets)
cat .gitignore
# You should see .env listed in the output

# 2e. Stage all files
git add .

# 2f. Review what you're about to commit
#     IMPORTANT: Make sure you do NOT see any .env files listed
git status

# 2g. Create the first commit
git commit -m "Initial commit — MindPath app and backend"

# 2h. Push to GitHub
git push -u origin main
```

**If you get a "main vs master" error:**
```bash
git branch -M main
git push -u origin main
```

**Verify:** Go to `https://github.com/YOUR_USERNAME/mindpath` — you should see all your files.

---

## STEP 3 — Set Up the Database (Neon — Free PostgreSQL)

Neon gives you a free serverless PostgreSQL database that works great with Prisma.

### 3a. Create your Neon database

1. Go to **https://neon.tech** → Sign up with GitHub (free)
2. Click **New Project**
3. Settings:
   - **Project name:** `mindpath`
   - **Database name:** `mindpath`
   - **Region:** Choose closest to you (us-east-1, eu-central-1, etc.)
4. Click **Create Project**

### 3b. Get your connection string

After creation, Neon shows you a connection string. It looks like:
```
postgresql://mindpath_owner:RANDOM_PASSWORD@ep-XXXX.us-east-2.aws.neon.tech/mindpath?sslmode=require
```

**Copy this — you need it in the next steps.**

⚠️ **Important:** Neon requires `?sslmode=require` at the end. Make sure it's there.

### 3c. Run your database migrations from your local machine

This sets up all the tables in your Neon database:

```bash
# Go into the backend folder
cd backend

# Create a temporary .env file for running migrations locally
# Replace the URL with YOUR actual Neon connection string
echo 'DATABASE_URL="postgresql://mindpath_owner:YOUR_PASSWORD@ep-XXXX.us-east-2.aws.neon.tech/mindpath?sslmode=require"' > .env

# Generate Prisma client
npx prisma generate

# Run migrations (creates all your tables in Neon)
npx prisma migrate deploy

# (Optional) Seed with demo data
npx ts-node prisma/seed.ts

# Verify — open Prisma Studio to see your tables in the browser
npx prisma studio
```

Prisma Studio opens at `http://localhost:5555` — you can see all your empty tables.

---

## STEP 4 — Deploy the Backend to Render

Render is the easiest free backend host for NestJS. No credit card required.

### 4a. Create a Render account

1. Go to **https://render.com** → Sign up with GitHub
2. Click **Authorize Render** to connect your GitHub

### 4b. Create a new Web Service

1. In the Render dashboard → click **New +** → **Web Service**
2. Connect your repository: find `mindpath` → click **Connect**
3. Configure the service:

| Setting | Value |
|---------|-------|
| **Name** | `mindpath-api` |
| **Region** | Oregon (US West) or Frankfurt |
| **Branch** | `main` |
| **Root Directory** | `backend` |
| **Runtime** | `Node` |
| **Build Command** | `npm ci && npx prisma generate && npm run build` |
| **Start Command** | `npx prisma migrate deploy && node dist/main` |
| **Instance Type** | `Free` |

4. Click **Advanced** → **Add Health Check Path** → type `/api/v1/health`

### 4c. Add environment variables in Render

Still on the setup page, scroll to **Environment Variables** and add each one:

| Key | Value |
|-----|-------|
| `NODE_ENV` | `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | *(Your Neon connection string from Step 3b)* |
| `JWT_SECRET` | *(Run `openssl rand -hex 32` in terminal — paste output)* |
| `JWT_REFRESH_SECRET` | *(Run `openssl rand -hex 32` again — different value)* |
| `ANTHROPIC_API_KEY` | *(Your key from console.anthropic.com)* |
| `ALLOWED_ORIGINS` | `*` *(for now — tighten later)* |

**How to generate secure secrets:**
```bash
# Run this in your terminal — copy the output for JWT_SECRET
openssl rand -hex 32

# Run again for JWT_REFRESH_SECRET (must be different)
openssl rand -hex 32
```

### 4d. Deploy

Click **Create Web Service**. Render will:
1. Clone your repo *(~10 seconds)*
2. Run `npm ci` *(~30 seconds)*
3. Build TypeScript *(~30 seconds)*
4. Run migrations *(~5 seconds)*
5. Start your server *(~5 seconds)*

Total: **~2 minutes** for the first deploy.

### 4e. Verify your backend is live

Your backend URL will be: `https://mindpath-api.onrender.com`

Test it:
```bash
# Health check
curl https://mindpath-api.onrender.com/api/v1/health

# Expected response:
# {"data":{"status":"ok","timestamp":"...","services":{"database":"connected"}}}
```

Also visit: `https://mindpath-api.onrender.com/api/docs` — this shows your Swagger API documentation.

---

## STEP 5 — Set Up GitHub Actions Secrets

GitHub Actions needs your secrets to run tests and trigger deploys.

### 5a. Get your Render deploy hook URL

1. In Render dashboard → your `mindpath-api` service
2. Go to **Settings** → scroll down to **Deploy Hook**
3. Click **Generate Deploy Hook** → copy the URL

It looks like: `https://api.render.com/deploy/srv-XXXXXXXXXXXX?key=XXXXXXXXXXXX`

### 5b. Add secrets to GitHub

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** for each:

| Secret Name | Value |
|-------------|-------|
| `RENDER_DEPLOY_HOOK_URL` | *(The deploy hook URL from Render)* |
| `ANTHROPIC_API_KEY` | *(Your Anthropic API key — used in CI tests)* |

That's it. GitHub Actions will now automatically deploy to Render whenever you push to `main`.

---

## STEP 6 — Connect the Mobile App to the Backend

### 6a. Create the mobile app environment file

In the **root** of your project (not the backend folder):

```bash
# Create a .env file for the mobile app
cat > .env << 'EOF'
# Mobile app environment variables
# These values are bundled into the app at build time — not truly secret
EXPO_PUBLIC_API_URL=https://mindpath-api.onrender.com/api/v1
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id-here
EOF
```

⚠️ **Important:** In Expo, any variable starting with `EXPO_PUBLIC_` is baked into the app bundle and is visible to users. **Never put secret API keys here.** Your Anthropic key lives on the backend only.

### 6b. Verify the connection

```bash
# Test the connection from your terminal
curl https://mindpath-api.onrender.com/api/v1/health

# Register a test user
curl -X POST https://mindpath-api.onrender.com/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpassword123","displayName":"Test User"}'

# You should see: {"data":{"tokens":{"accessToken":"..."},"user":{...}}}
```

---

## STEP 7 — Run the Mobile App Locally with Expo Go

You can test your app immediately using Expo Go — no app store submission needed.

### 7a. Install Expo Go on your phone

- **iPhone:** App Store → search "Expo Go"
- **Android:** Play Store → search "Expo Go"

### 7b. Start the development server

```bash
# Go to the root of your project (not the backend folder)
cd /path/to/mindpath

# Install dependencies if you haven't already
npm install

# Start Expo development server
npx expo start
```

This shows a QR code in your terminal.

### 7c. Open the app on your phone

- **iPhone:** Open the Camera app → point at the QR code
- **Android:** Open Expo Go → tap "Scan QR code"

Your app opens on your phone and connects to your real backend on Render! 🎉

### 7d. Development tips

```bash
# Press 'a' in the terminal to open Android emulator
# Press 'i' to open iOS simulator (Mac only)
# Press 'r' to reload the app
# Press 'j' to open the debugger
```

---

## STEP 8 — Build a Shareable App with EAS (Expo Application Services)

EAS lets you build a real `.apk` (Android) or `.ipa` (iOS) file that you can share with testers — without publishing to an app store.

### 8a. Create an Expo account

1. Go to **https://expo.dev** → Sign up (free)
2. Verify your email

### 8b. Log in from your terminal

```bash
# Install EAS CLI globally
npm install -g eas-cli

# Log in to your Expo account
eas login
# Enter your Expo email and password
```

### 8c. Configure your project with Expo

```bash
# Link your local project to your Expo account
# This creates a project ID and updates app.json
eas init

# This asks:
# "What would you like to call your project?" → mindpath
# It generates a project ID — copy it, you need it in Step 6a
```

### 8d. Build a preview APK (Android — works without Play Store)

```bash
# Build an installable .apk file for Android
# Free tier: 30 builds/month
eas build --platform android --profile preview

# This takes about 5-10 minutes
# When done, Expo gives you a download link for the .apk
```

**Share with testers:** Send them the download link. They install it directly on Android (they need to enable "Install from unknown sources" in Settings).

### 8e. Build for iOS (requires free Apple Developer account for simulator)

```bash
# Build for iOS simulator (Mac only, no Apple account needed)
eas build --platform ios --profile development

# For real iPhone testing — requires Apple Developer account ($99/year)
# There is NO free way to install on real iPhones outside of TestFlight
```

### 8f. Update the app without a new build (OTA updates)

This is one of Expo's best features — push updates instantly without going through app stores:

```bash
# After changing any JS/TypeScript code:
eas update --branch production --message "Fix login button"

# Users get the update automatically next time they open the app
```

---

## STEP 9 — Set Up Automatic Deployments

Once GitHub Actions and Render are configured, deployments are fully automatic.

### How it works:

```
You edit code on your laptop
         │
         ▼
git add . && git commit -m "feat: add mood trend chart"
         │
         ▼
git push origin main
         │
         ▼
GitHub receives the push
         │
         ├─► GitHub Actions starts automatically
         │         │
         │         ├─► Starts test database (PostgreSQL in Docker)
         │         ├─► Installs dependencies
         │         ├─► Runs migrations on test DB
         │         ├─► Runs all unit tests
         │         └─► If tests pass → triggers Render deploy hook
         │
         └─► Render receives deploy hook
                   │
                   ├─► Pulls latest code from GitHub
                   ├─► Runs: npm ci && prisma generate && npm run build
                   ├─► Runs: prisma migrate deploy (on real DB)
                   └─► Restarts server with new code
```

**Total time from `git push` to live:** ~3-5 minutes

### Monitoring your deploys

- **GitHub Actions:** `https://github.com/YOUR_USERNAME/mindpath/actions`
- **Render dashboard:** `https://dashboard.render.com`
- **Live logs:** In Render → your service → **Logs** tab

---

## STEP 10 — Environment Variables Reference

### Backend (.env in /backend — never commit this file)

```bash
# Server
NODE_ENV=production
PORT=3000
APP_URL=https://mindpath-api.onrender.com

# CORS — add your Expo dev URL here too during development
ALLOWED_ORIGINS=https://mindpath-api.onrender.com,exp://192.168.1.100:8081

# Database (Neon)
DATABASE_URL="postgresql://mindpath_owner:PASSWORD@ep-XXXX.us-east-2.aws.neon.tech/mindpath?sslmode=require"

# Auth — generate with: openssl rand -hex 32
JWT_SECRET=your-64-char-random-hex-string
JWT_REFRESH_SECRET=different-64-char-random-hex-string
JWT_EXPIRES_IN=7d

# AI
ANTHROPIC_API_KEY=sk-ant-api03-...

# Rate limiting
THROTTLE_TTL=60000
THROTTLE_LIMIT=60

# Push notifications (optional for MVP)
EXPO_ACCESS_TOKEN=

# Email (optional — needed for magic links)
SMTP_HOST=smtp.resend.com
SMTP_PORT=465
SMTP_USER=resend
SMTP_PASS=re_...
FROM_EMAIL=noreply@yourdomain.com
```

### Mobile app (.env in project root — safe to commit, no secrets)

```bash
# All EXPO_PUBLIC_ variables are visible in the app bundle
EXPO_PUBLIC_API_URL=https://mindpath-api.onrender.com/api/v1
EXPO_PUBLIC_PROJECT_ID=your-expo-project-id
```

### GitHub Secrets (set in GitHub → Settings → Secrets)

| Secret | Used for |
|--------|----------|
| `RENDER_DEPLOY_HOOK_URL` | Triggering Render deploys from CI |
| `ANTHROPIC_API_KEY` | Running AI-related tests in CI |

---

## STEP 11 — Troubleshooting Common Problems

### ❌ "Application failed to start" on Render

**Cause:** Usually a missing environment variable or migration failure.

**Fix:**
```bash
# Check Render logs in the dashboard (Logs tab)
# Common fixes:

# 1. Make sure DATABASE_URL ends with ?sslmode=require
DATABASE_URL="...?sslmode=require"   ✓

# 2. Make sure JWT_SECRET is at least 32 characters
# 3. Check that your build command works locally:
cd backend && npm ci && npx prisma generate && npm run build
```

### ❌ "Database connection refused" or "Can't reach database server"

**Cause:** Wrong connection string or SSL issue.

**Fix:**
```bash
# Test the connection from your terminal
cd backend
npx prisma db pull   # This tests the connection and shows your schema

# If it fails: check your DATABASE_URL in Render → Environment Variables
# Make sure it matches exactly what Neon shows (including the password)
```

### ❌ App shows "Network request failed" or can't connect to backend

**Cause:** Wrong API URL in the mobile app, or Render is still waking up.

**Fix:**
```bash
# 1. Check your .env has the correct URL (no trailing slash)
EXPO_PUBLIC_API_URL=https://mindpath-api.onrender.com/api/v1   ✓
EXPO_PUBLIC_API_URL=https://mindpath-api.onrender.com/api/v1/  ✗ (no trailing slash)

# 2. Wake up Render (free tier sleeps after 15 min inactivity)
curl https://mindpath-api.onrender.com/api/v1/health
# Wait 30 seconds, then try the app again

# 3. Check CORS — add your IP to ALLOWED_ORIGINS in Render:
ALLOWED_ORIGINS=https://mindpath-api.onrender.com,*
# (Use * temporarily for debugging, tighten to your Expo URL in production)
```

### ❌ "Could not find module" or TypeScript errors on Render

**Cause:** Missing `prisma generate` step in build command.

**Fix:** Make sure your Render build command is exactly:
```
npm ci && npx prisma generate && npm run build
```

### ❌ GitHub Actions fails: "DATABASE_URL is undefined"

**Cause:** The test job uses a local Postgres container — it needs a connection string pointed at that container, not Neon.

**Fix:** The workflow file already handles this — the test job sets:
```yaml
env:
  DATABASE_URL: postgresql://test:test@localhost:5432/mindpath_test
```
This is separate from your production Neon database.

### ❌ Expo app shows blank screen or crashes

**Fix:**
```bash
# Clear Expo cache and restart
npx expo start --clear

# Check for TypeScript errors
npx tsc --noEmit

# Check the Expo logs in the terminal for error messages
```

### ❌ "Too many requests" from Anthropic API

**Cause:** Hitting the Anthropic rate limit.

**Fix:** Add error handling in your AI service, which already exists in the codebase. Check your Anthropic usage at `console.anthropic.com`.

### ❌ Render free tier is too slow (30s wake time)

**Fix options:**
1. **Upgrade to Render Starter ($7/mo)** — eliminates sleep, much faster
2. **Use Railway instead** — $5 free credit/month, no sleep on hobby plan
3. **Add a cron job to ping your backend every 14 minutes** using cron-job.org (free)

**Cron-job.org keep-alive (free trick):**
1. Go to https://cron-job.org → Sign up
2. Create a job:
   - URL: `https://mindpath-api.onrender.com/api/v1/health`
   - Schedule: every 14 minutes
3. This prevents Render from sleeping your backend

---

## STEP 12 — Railway Alternative (If You Prefer)

Railway is slightly more generous on the free tier and never sleeps on the Hobby plan ($5 free credit/month).

### Deploy to Railway instead of Render

```bash
# Install Railway CLI
npm install -g @railway/cli

# Log in
railway login

# In your backend folder:
cd backend

# Initialize Railway project
railway init

# Deploy
railway up

# Set environment variables
railway variables set NODE_ENV=production
railway variables set DATABASE_URL="your-neon-connection-string"
railway variables set JWT_SECRET="your-secret"
railway variables set JWT_REFRESH_SECRET="your-other-secret"
railway variables set ANTHROPIC_API_KEY="sk-ant-..."

# Open your deployed app
railway open
```

Railway auto-detects Node.js and handles the rest. Your backend URL will be something like `https://mindpath-api.up.railway.app`.

---

## STEP 13 — Security Best Practices

These are essential — especially since your app handles mental health data.

### ✅ Things you MUST do before going to real users

```bash
# 1. Tighten ALLOWED_ORIGINS — replace * with your actual domains
ALLOWED_ORIGINS=https://mindpath-api.onrender.com,exp://your-expo-url

# 2. Rotate your JWT secrets — never reuse defaults
openssl rand -hex 32   # Use this for JWT_SECRET
openssl rand -hex 32   # Use this for JWT_REFRESH_SECRET

# 3. Enable Neon connection pooling for production traffic
# In Neon dashboard → Connection Pooling → enable PgBouncer
# Use the pooled connection string (it's different from the direct one)

# 4. Set rate limiting tighter for auth endpoints
# Already configured in your backend — review throttle settings

# 5. Verify no secrets in git history
git log --all -- '*.env'          # Should show nothing
git grep -i "sk-ant" HEAD         # Should show nothing
git grep -i "password" HEAD       # Review any results
```

### ✅ GitHub repo settings

1. Go to your repo → **Settings** → **Branches**
2. Add branch protection for `main`:
   - ✓ Require status checks to pass (select your CI workflow)
   - ✓ Require branches to be up to date
3. This prevents anyone (including you) from pushing broken code directly to production.

### ✅ Environment variable audit checklist

Before going live, verify each variable is set correctly:

```bash
# Run this on your local machine to test the production config
curl https://mindpath-api.onrender.com/api/v1/health | jq .

# Expected output shows database is connected:
# { "status": "ok", "services": { "database": "connected" } }
```

---

## Final Checklist

Run through this before telling anyone your app is live:

```
GitHub
□ Repository created (private)
□ .gitignore includes .env files
□ No secrets visible in git history
□ GitHub Actions workflows committed
□ RENDER_DEPLOY_HOOK_URL secret added
□ ANTHROPIC_API_KEY secret added

Database (Neon)
□ Project created
□ Connection string copied
□ Migrations ran successfully (prisma migrate deploy)
□ Tables visible in Prisma Studio

Backend (Render)
□ Web service created
□ Build command: npm ci && npx prisma generate && npm run build
□ Start command: npx prisma migrate deploy && node dist/main
□ All environment variables set
□ Health check path: /api/v1/health
□ /api/v1/health returns {"status":"ok"}
□ Swagger docs accessible at /api/docs

Mobile App
□ EXPO_PUBLIC_API_URL points to Render URL
□ Expo Go works on your phone
□ EAS initialized (eas init)
□ Preview build successful (eas build --platform android --profile preview)
□ App connects to backend (test login/register)

CI/CD
□ Push to main triggers GitHub Actions
□ Tests pass in CI
□ Render deploys automatically after tests pass
□ Deploy confirmed live after push
```

---

## Cost Summary

| Service | Free Tier | Limit |
|---------|-----------|-------|
| **GitHub** | ✅ Free | 2000 CI min/month, unlimited private repos |
| **Neon** | ✅ Free | 512 MB, 1 database |
| **Render** | ✅ Free | Sleeps after 15 min, 750 hrs/month |
| **Expo** | ✅ Free | 30 EAS builds/month |
| **Anthropic** | 💳 Pay-per-use | ~$0.003 per AI insight generation |

**Total fixed cost: $0/month**
**Variable cost: Anthropic API usage only** (very low during development)

When you're ready to upgrade for production: Render Starter ($7/mo) + Neon Launch ($19/mo) = **$26/month for a fully production-grade setup**.
