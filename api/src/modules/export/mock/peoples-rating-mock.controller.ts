import { randomUUID } from 'node:crypto';

import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { ExportPayloadDto } from '../dto/export-payload.dto';
import { MockReceiptResponseDto } from '../dto/mock-receipt-response.dto';

@ApiTags('Mock External Rating API')
@Controller('mock/peoples-rating')
export class PeoplesRatingMockController {
  @Post('batch')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Имитационный приёмник «Народного винного рейтинга»',
    description:
      'Проверяет пакет выгрузки по OpenAPI-схеме, имитирует сетевую ' +
      'задержку около 50 мс и возвращает квитанцию приёма.',
  })
  @ApiResponse({
    status: 200,
    description: 'Пакет принят имитационным приёмником',
    type: MockReceiptResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: 'Пакет не соответствует схеме',
  })
  async receiveBatch(
    @Body() payload: ExportPayloadDto,
  ): Promise<MockReceiptResponseDto> {
    await new Promise((resolve) => setTimeout(resolve, 50));

    return {
      receiptId: `pr_mock_${randomUUID()}_accepted`,
      status: 'ACCEPTED_BY_MOCK',
      receivedSamplesCount: payload.samples.length,
      processedAt: new Date().toISOString(),
    };
  }
}
