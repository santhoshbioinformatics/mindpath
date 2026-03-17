// src/common/decorators/api-paginated.decorator.ts
import { applyDecorators } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

export function ApiPaginationQuery() {
  return applyDecorators(
    ApiQuery({
      name: 'limit',
      required: false,
      type: Number,
      description: 'Max results (default 20)',
    }),
    ApiQuery({
      name: 'offset',
      required: false,
      type: Number,
      description: 'Offset for pagination',
    }),
  );
}
