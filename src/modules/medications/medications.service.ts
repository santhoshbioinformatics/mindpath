// src/modules/medications/medications.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateMedicationDto, LogMedicationDto } from './dto/medication.dto';
import { subDays, startOfDay, endOfDay } from 'date-fns';
import type { MedFrequency, MedLogStatus } from '@prisma/client';

@Injectable()
export class MedicationsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(userId: string) {
    const medications = await this.prisma.medication.findMany({
      where: { userId, isActive: true },
      include: {
        logs: { orderBy: { scheduledAt: 'desc' }, take: 5 },
      },
      orderBy: { createdAt: 'asc' },
    });
    return { medications };
  }

  async getTodayStatus(userId: string) {
    const medications = await this.prisma.medication.findMany({
      where: { userId, isActive: true },
    });

    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    return Promise.all(
      medications.map(async (med) => {
        const log = await this.prisma.medicationLog.findFirst({
          where: {
            medicationId: med.id,
            scheduledAt: { gte: startOfDay(now), lte: endOfDay(now) },
          },
          orderBy: { scheduledAt: 'desc' },
        });

        const isDue = med.reminderTimes.some((t) => {
          const [h, m] = t.split(':').map(Number);
          const remMin = h * 60 + m;
          const diff = currentMinutes - remMin;
          return diff >= 0 && diff <= 120;
        });

        return { medication: med, log: log ?? null, isDue };
      }),
    );
  }

  async create(userId: string, dto: CreateMedicationDto) {
    const medication = await this.prisma.medication.create({
      data: {
        userId,
        name: dto.name,
        doseMg: dto.doseMg,
        doseUnit: dto.doseUnit,
        frequency: dto.frequency as MedFrequency,
        reminderTimes: dto.reminderTimes,
        refillDate: dto.refillDate ? new Date(dto.refillDate) : undefined,
        notes: dto.notes,
      },
    });
    return { medication };
  }

  async update(userId: string, id: string, dto: Partial<CreateMedicationDto>) {
    await this.assertOwnership(userId, id);
    const medication = await this.prisma.medication.update({
      where: { id },
      data: {
        name: dto.name,
        doseMg: dto.doseMg,
        doseUnit: dto.doseUnit,
        frequency: dto.frequency as MedFrequency | undefined,
        reminderTimes: dto.reminderTimes,
        refillDate: dto.refillDate ? new Date(dto.refillDate) : undefined,
        notes: dto.notes,
      },
    });
    return { medication };
  }

  async remove(userId: string, id: string) {
    await this.assertOwnership(userId, id);
    await this.prisma.medication.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async log(userId: string, medicationId: string, dto: LogMedicationDto) {
    await this.assertOwnership(userId, medicationId);
    const log = await this.prisma.medicationLog.create({
      data: {
        medicationId,
        status: dto.status as MedLogStatus,
        scheduledAt: new Date(dto.scheduledAt),
        actionAt: new Date(),
        notes: dto.notes,
      },
    });
    return { log };
  }

  async getAdherence(userId: string, medicationId: string) {
    await this.assertOwnership(userId, medicationId);
    const since = subDays(new Date(), 28);
    const logs = await this.prisma.medicationLog.findMany({
      where: { medicationId, scheduledAt: { gte: since } },
      orderBy: { scheduledAt: 'desc' },
    });

    const taken = logs.filter((l) => l.status === 'taken').length;
    const total = logs.length;
    const adherencePct = total > 0 ? Math.round((taken / total) * 100) : 0;

    const takenDates = new Set(
      logs
        .filter((l) => l.status === 'taken')
        .map((l) => l.scheduledAt.toISOString().split('T')[0]),
    );
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 28; i++) {
      const d = subDays(today, i).toISOString().split('T')[0];
      if (takenDates.has(d)) streak++;
      else break;
    }

    return { adherencePct, streak, taken, total, logs };
  }

  private async assertOwnership(userId: string, medicationId: string) {
    const med = await this.prisma.medication.findUnique({
      where: { id: medicationId },
    });
    if (!med) throw new NotFoundException('Medication not found.');
    if (med.userId !== userId) throw new ForbiddenException();
    return med;
  }
}
