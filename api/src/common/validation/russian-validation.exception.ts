import { BadRequestException } from '@nestjs/common';
import type { ValidationError } from 'class-validator';

function collectMessages(
  errors: ValidationError[],
  parentPath = '',
): string[] {
  const messages: string[] = [];

  for (const error of errors) {
    const path = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;

    if (error.constraints) {
      for (const [key, message] of Object.entries(error.constraints)) {
        if (key === 'whitelistValidation') {
          messages.push(`Свойство «${path}» не разрешено`);
        } else if (key === 'nestedValidation') {
          messages.push(
            `Поле «${path}» должно быть объектом или массивом объектов`,
          );
        } else {
          messages.push(message);
        }
      }
    }

    if (error.children && error.children.length > 0) {
      messages.push(...collectMessages(error.children, path));
    }
  }

  return messages;
}

/**
 * Produces a localized validation error response for all DTO pipes.
 */
export function createRussianValidationException(
  errors: ValidationError[],
): BadRequestException {
  const messages = [...new Set(collectMessages(errors))];

  return new BadRequestException(
    messages.length > 0 ? messages : ['Некорректные данные запроса'],
  );
}
