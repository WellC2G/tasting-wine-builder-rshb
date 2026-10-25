import { ApiProperty } from '@nestjs/swagger';

import { UserResponseDto } from './user-response.dto';

export class AuthTokenResponseDto {
  @ApiProperty({
    description: 'JWT для авторизации запросов организатора',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken!: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType!: string;

  @ApiProperty({
    description: 'Время жизни токена в секундах',
    example: 43200,
  })
  expiresIn!: number;

  @ApiProperty({ type: UserResponseDto })
  user!: UserResponseDto;
}
