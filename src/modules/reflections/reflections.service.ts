// src/modules/reflections/reflections.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AIService } from '../../ai/ai.service';
import { CreateReflectionDto } from './dto/reflection.dto';

@Injectable()
export class ReflectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIService,
  ) {}

  async create(userId: string, dto: CreateReflectionDto) {
    const aiSummary = await this.ai
      .summarizeReflection({
        wentWell: dto.wentWell,
        wasDifficult: dto.wasDifficult,
        learned: dto.learned,
        mattersNow: dto.mattersNow,
        freeText: dto.freeText,
      })
      .catch(() => undefined);

    const reflection = await this.prisma.reflectionEntry.create({
      data: {
        userId,
        wentWell: dto.wentWell,
        wasDifficult: dto.wasDifficult,
        learned: dto.learned,
        mattersNow: dto.mattersNow,
        tomorrowPlan: dto.tomorrowPlan,
        freeText: dto.freeText,
        tags: dto.tags ?? [],
        aiSummary,
      },
    });
    return { reflection };
  }

  async getHistory(userId: string, limit: number, offset: number) {
    const [reflections, total] = await Promise.all([
      this.prisma.reflectionEntry.findMany({
        where: { userId },
        orderBy: { reflectedAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.reflectionEntry.count({ where: { userId } }),
    ]);
    return { reflections, total, limit, offset };
  }

  async getOne(userId: string, id: string) {
    const r = await this.prisma.reflectionEntry.findUnique({ where: { id } });
    if (!r) throw new NotFoundException();
    if (r.userId !== userId) throw new ForbiddenException();
    return { reflection: r };
  }

  async summarize(userId: string, id: string) {
    const { reflection: r } = await this.getOne(userId, id);
    const summary = await this.ai.summarizeReflection({
      wentWell: r.wentWell ?? undefined,
      wasDifficult: r.wasDifficult ?? undefined,
      learned: r.learned ?? undefined,
      mattersNow: r.mattersNow ?? undefined,
      freeText: r.freeText ?? undefined,
    });
    await this.prisma.reflectionEntry.update({
      where: { id },
      data: { aiSummary: summary },
    });
    return { summary };
  }

  async previewSummary(dto: Partial<CreateReflectionDto>) {
    const summary = await this.ai.summarizeReflection({
      wentWell: dto.wentWell,
      wasDifficult: dto.wasDifficult,
      learned: dto.learned,
      mattersNow: dto.mattersNow,
      freeText: dto.freeText,
    });
    return { summary };
  }
}
