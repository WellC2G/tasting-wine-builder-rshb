import { ApiProperty } from '@nestjs/swagger';

export class NetworkAddressResponseDto {
  @ApiProperty({
    type: String,
    nullable: true,
    example: '192.168.0.115',
    description:
      'Локальный IPv4-адрес хоста для QR-кодов или null, если определить не удалось',
  })
  lanIp!: string | null;
}
