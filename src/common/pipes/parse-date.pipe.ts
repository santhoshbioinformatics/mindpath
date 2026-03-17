// src/common/pipes/parse-date.pipe.ts
import { Injectable, PipeTransform, BadRequestException } from '@nestjs/common';

@Injectable()
export class ParseDatePipe implements PipeTransform {
  transform(value: unknown): Date | undefined {
    if (!value) return undefined;
    const date = new Date(value as string);
    if (isNaN(date.getTime())) {
      throw new BadRequestException(`Invalid date: ${value}`);
    }
    return date;
  }
}
