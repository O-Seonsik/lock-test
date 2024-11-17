import { RedisModule as NestRedisModule } from '@nestjs-modules/ioredis';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    NestRedisModule.forRoot({
      type: 'single',
      url: 'redis://localhost:6379',
    }),
  ],
})
export class RedisModule {}
