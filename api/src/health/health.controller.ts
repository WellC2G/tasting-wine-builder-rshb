import {
  Body,
  Controller,
  Get,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { LanAddressService } from '../common/network/lan-address.service';
import { JwtAuthGuard } from '../modules/auth/guards/jwt-auth.guard';
import { HealthResponseDto } from './dto/health-response.dto';
import { NetworkAddressResponseDto } from './dto/network-address-response.dto';
import { UpdateLanIpDto } from './dto/update-lan-ip.dto';

const SERVICE_NAME = 'tasting-constructor-api';
const SERVICE_VERSION = '0.1.0';

@ApiTags('Проверка состояния')
@Controller('health')
export class HealthController {
  constructor(
    private readonly lanAddressService: LanAddressService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Проверка доступности API',
    description: 'Используется Docker Compose для healthcheck контейнера.',
  })
  @ApiOkResponse({
    type: HealthResponseDto,
    description: 'API доступен',
  })
  check(): HealthResponseDto {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      timestamp: new Date().toISOString(),
    };
  }

  @Get('network')
  @ApiOperation({
    summary: 'Локальный адрес хоста',
    description:
      'Возвращает LAN IPv4-адрес организатора для QR-кодов гостей и ' +
      'сомелье. Адрес определяется из переменных окружения, сетевых ' +
      'интерфейсов или последнего запроса, пришедшего по Wi-Fi.',
  })
  @ApiOkResponse({
    type: NetworkAddressResponseDto,
    description: 'LAN-адрес найден или равен null',
  })
  network(): NetworkAddressResponseDto {
    return { lanIp: this.lanAddressService.getLanIp() };
  }

  @Put('network')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('host-jwt')
  @ApiOperation({
    summary: 'Задать LAN-адрес для QR-кодов',
    description:
      'Сохраняет адрес, введённый организатором вручную, если Docker ' +
      'Desktop не позволяет автоматически определить LAN-интерфейс.',
  })
  @ApiOkResponse({
    type: NetworkAddressResponseDto,
    description: 'LAN-адрес сохранён',
  })
  @ApiResponse({ status: 400, description: 'Некорректный LAN-адрес' })
  @ApiResponse({ status: 401, description: 'Требуется авторизация' })
  updateNetwork(
    @Body() dto: UpdateLanIpDto,
  ): NetworkAddressResponseDto {
    return { lanIp: this.lanAddressService.setManualLanIp(dto.lanIp) };
  }
}
