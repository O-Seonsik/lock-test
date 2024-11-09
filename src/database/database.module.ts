import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MysqlLockTestFactory } from './factory/mysql-lock-test.factory';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      name: 'default',
      useClass: MysqlLockTestFactory,
    }),
  ],
})
export class DatabaseModule {}
