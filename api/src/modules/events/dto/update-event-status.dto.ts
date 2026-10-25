import { ApiProperty } from '@nestjs/swagger';
import { IsIn } from 'class-validator';

import { TastingEventStatus } from '../entities/tasting-event.entity';

export const EDITABLE_EVENT_STATUSES = [
  TastingEventStatus.DRAFT,
  TastingEventStatus.ACTIVE,
  TastingEventStatus.FINISHED,
] as const;

export class UpdateEventStatusDto {
  @ApiProperty({
    description: 'Новый статус мероприятия',
    enum: EDITABLE_EVENT_STATUSES,
    example: TastingEventStatus.ACTIVE,
  })
  @IsIn(EDITABLE_EVENT_STATUSES, {
    message: 'Статус должен быть одним из: DRAFT, ACTIVE, FINISHED',
  })
  status!: TastingEventStatus;
}
