import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { LanAddressService } from './lan-address.service';
import { LanHostInterceptor } from './lan-host.interceptor';

@Global()
@Module({
  providers: [
    LanAddressService,
    {
      provide: APP_INTERCEPTOR,
      useClass: LanHostInterceptor,
    },
  ],
  exports: [LanAddressService],
})
export class NetworkModule {}
