import { ApiProperty } from '@nestjs/swagger';
import { IsIP } from 'class-validator';

export class UpdateLanIpDto {
  @ApiProperty({
    description:
      'Локальный IPv4-адрес хоста в сети Wi-Fi, например 192.168.0.115',
    example: '192.168.0.115',
  })
  @IsIP(4, {
    message:
      'Укажите корректный локальный IPv4-адрес, например 192.168.0.115',
  })
  lanIp!: string;
}
