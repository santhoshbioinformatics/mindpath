// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo user
  const passwordHash = await bcrypt.hash('password123', 12);

  const user = await prisma.user.upsert({
    where: { email: 'demo@mindpath.app' },
    update: {},
    create: {
      email: 'demo@mindpath.app',
      passwordHash,
      profile: {
        create: {
          displayName: 'Jordan Kim',
          timezone: 'America/New_York',
          primaryGoals: ['reduce_anxiety', 'track_mood', 'improve_sleep'],
          onboardingDone: true,
          baselineDone: true,
          currentStreak: 5,
          longestStreak: 12,
          lastCheckIn: new Date(),
        },
      },
    },
    include: { profile: true },
  });

  console.log(`✓ User: ${user.email}`);

  // Mission statement
  await prisma.missionStatement.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      content:
        'To be present for my family and build something meaningful at work, without burning out.',
    },
  });

  // Goals
  const goals = [
    { title: 'Reduce anxiety below 40 avg', category: 'wellbeing' as const, progress: 45 },
    { title: 'Exercise 3x per week', category: 'health' as const, progress: 60 },
    { title: 'Sleep 7+ hours consistently', category: 'health' as const, progress: 30 },
  ];
  for (const g of goals) {
    await prisma.goal.create({ data: { userId: user.id, ...g } });
  }
  console.log('✓ Goals seeded');

  // Medications
  const med = await prisma.medication.create({
    data: {
      userId: user.id,
      name: 'Sertraline',
      doseMg: 50,
      doseUnit: 'mg',
      frequency: 'daily',
      reminderTimes: ['08:00'],
    },
  });

  await prisma.medication.create({
    data: {
      userId: user.id,
      name: 'Vitamin D',
      doseMg: 2000,
      doseUnit: 'IU',
      frequency: 'daily',
      reminderTimes: ['12:00'],
    },
  });
  console.log('✓ Medications seeded');

  // 14 days of check-ins
  const baseDate = new Date();
  for (let i = 13; i >= 0; i--) {
    const date = new Date(baseDate);
    date.setDate(date.getDate() - i);
    date.setHours(8, 30, 0, 0);

    const mood = Math.floor(Math.random() * 30) + 55; // 55–85
    const anxiety = Math.floor(Math.random() * 40) + 25; // 25–65
    const energy = Math.floor(Math.random() * 35) + 50; // 50–85
    const clarity = Math.floor(Math.random() * 30) + 55; // 55–85
    const sleep = Math.floor(Math.random() * 40) + 40; // 40–80
    const overall = Math.round((mood + energy + clarity + (100 - anxiety) + sleep) / 5);

    await prisma.dailyCheckIn.create({
      data: {
        userId: user.id,
        mood,
        anxiety,
        energy,
        clarity,
        sleepQuality: sleep,
        stressTags: i % 3 === 0 ? ['work_pressure'] : [],
        overallScore: overall,
        checkedInAt: date,
      },
    });

    // Med log for sertraline
    await prisma.medicationLog.create({
      data: {
        medicationId: med.id,
        status: i % 7 === 0 ? 'skipped' : 'taken',
        scheduledAt: new Date(date),
        actionAt: new Date(date),
      },
    });
  }
  console.log('✓ 14 days of check-ins seeded');

  // A few reflections
  const reflections = [
    {
      wentWell: 'Had a good team meeting and felt heard for once.',
      wasDifficult: 'Traffic was brutal and I arrived stressed.',
      mattersNow: 'Making time for the kids in the evening.',
      tags: ['work', 'family'],
      aiSummary:
        'A mixed day — professional wins tempered by commute stress, with family connection as the anchor.',
    },
    {
      wentWell: 'Went for a 30 minute run. First time in two weeks.',
      wasDifficult: 'Anxiety spiked in the afternoon for no clear reason.',
      learned: "Movement helps even when I don't feel like it.",
      tags: ['health', 'anxiety'],
      aiSummary:
        'Exercise broke a two-week drought and offered real relief, though afternoon anxiety was a reminder of the ongoing work.',
    },
  ];
  for (const r of reflections) {
    await prisma.reflectionEntry.create({ data: { userId: user.id, ...r } });
  }
  console.log('✓ Reflections seeded');

  // Sample insights
  const insights = [
    {
      type: 'correlation' as const,
      title: 'Less sleep → lower focus',
      body: 'On nights with poor sleep quality, your next-day mental clarity drops 28% on average.',
      confidence: 0.87,
      suggestedAction: 'Try a consistent 10pm bedtime this week',
      supportingData: { factorA: 'sleep', factorB: 'cognition' },
    },
    {
      type: 'correlation' as const,
      title: 'Exercise → better mood',
      body: "Your mood averages 19 points higher on days you exercise vs days you don't.",
      confidence: 0.81,
      suggestedAction: 'Schedule one workout this week',
      supportingData: { factorA: 'exercise', factorB: 'mood' },
    },
    {
      type: 'prediction' as const,
      title: '⚡ Stress Watch · Monday pattern',
      body: 'Based on 3 weeks of data, your stress consistently spikes on Mondays. Today is Monday — consider a decompression activity this evening.',
      confidence: 0.74,
      suggestedAction: 'Log a mindfulness activity tonight',
    },
    {
      type: 'daily' as const,
      title: 'Sleep impacting clarity today',
      body: "Your sleep score last night was below 50 — on similar nights, your clarity score the next day averages 22 points lower than your baseline. It's worth a gentle pace today.",
      suggestedAction: 'Protect tonight for rest',
    },
  ];
  for (const ins of insights) {
    await prisma.insight.create({
      data: { userId: user.id, ...ins, expiresAt: new Date(Date.now() + 7 * 86400000) },
    });
  }
  console.log('✓ Insights seeded');

  // Trusted contact
  await prisma.trustedContact.create({
    data: {
      userId: user.id,
      name: 'Sarah Kim',
      relation: 'Sister',
      phone: '+15550123456',
      isPrimary: true,
    },
  });

  // Notification prefs
  await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: {},
    create: {
      userId: user.id,
      checkInTime: '08:00',
      checkInEnabled: true,
      medicationEnabled: true,
      weeklyReportEnabled: true,
      streakEnabled: true,
    },
  });

  console.log('\n✅ Seed complete. Demo login: demo@mindpath.app / password123');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
