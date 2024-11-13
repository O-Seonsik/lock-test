import { Module } from '@nestjs/common';
import { SellerService } from './seller.service';

@Module({
  providers: [SellerService],
})
export class SellerModule {}
