import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { ExportPayloadDto } from '../dto/export-payload.dto';
import { ExportExternalStatus } from '../enums/export-external-status.enum';

export const DEFAULT_PEOPLES_RATING_WEBHOOK_URL =
  'http://127.0.0.1:4000/api/v1/mock/peoples-rating/batch';

export interface PeoplesRatingDispatchResult {
  success: boolean;
  externalStatus: ExportExternalStatus;
  targetEndpoint: string;
  isMockTarget: boolean;
  receiptId: string | null;
  httpStatus: number | null;
  errorMessage: string | null;
}

@Injectable()
export class PeoplesRatingClientAdapter {
  private readonly logger = new Logger(
    PeoplesRatingClientAdapter.name,
  );

  constructor(private readonly configService: ConfigService) {}

  async dispatch(
    payload: ExportPayloadDto,
  ): Promise<PeoplesRatingDispatchResult> {
    const targetEndpoint = this.getTargetEndpoint();
    const isMockTarget = this.isMockTarget(targetEndpoint);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(targetEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
      const responseText = await response.text();

      if (!response.ok) {
        const errorMessage = `HTTP ${response.status}: ${responseText.slice(0, 500)}`;
        this.logger.error(
          `External rating receiver rejected the export: ${errorMessage}`,
        );
        return {
          success: false,
          externalStatus: ExportExternalStatus.FAILED,
          targetEndpoint,
          isMockTarget,
          receiptId: null,
          httpStatus: response.status,
          errorMessage,
        };
      }

      const responseBody = this.parseJson(responseText);
      const receiptId = this.extractReceiptId(responseBody);

      return {
        success: true,
        externalStatus: isMockTarget
          ? ExportExternalStatus.MOCK_SUCCESS
          : ExportExternalStatus.WEBHOOK_SUCCESS,
        targetEndpoint,
        isMockTarget,
        receiptId,
        httpStatus: response.status,
        errorMessage: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.logger.error(
        `Failed to dispatch export to ${targetEndpoint}: ${errorMessage}`,
      );

      return {
        success: false,
        externalStatus: ExportExternalStatus.FAILED,
        targetEndpoint,
        isMockTarget,
        receiptId: null,
        httpStatus: null,
        errorMessage,
      };
    } finally {
      clearTimeout(timeout);
    }
  }

  private getTargetEndpoint(): string {
    const configured =
      this.configService.get<string>('PEOPLES_RATING_WEBHOOK_URL');

    return configured?.trim() || DEFAULT_PEOPLES_RATING_WEBHOOK_URL;
  }

  private isMockTarget(targetEndpoint: string): boolean {
    try {
      return new URL(targetEndpoint).pathname.includes(
        '/api/v1/mock/peoples-rating/batch',
      );
    } catch {
      return false;
    }
  }

  private parseJson(responseText: string): unknown {
    if (!responseText) {
      return null;
    }

    try {
      return JSON.parse(responseText) as unknown;
    } catch {
      return null;
    }
  }

  private extractReceiptId(responseBody: unknown): string | null {
    if (typeof responseBody !== 'object' || responseBody === null) {
      return null;
    }

    const receiptId = (responseBody as { receiptId?: unknown })
      .receiptId;

    return typeof receiptId === 'string' ? receiptId : null;
  }
}
