import { Module } from '@nestjs/common';
import { ProductsService } from './products.service';
import { DistributedLockModule } from '../distributed-lock/distributed-lock.module';

@Module({
  imports: [DistributedLockModule],
  providers: [ProductsService],
})
export class ProductsModule {}
