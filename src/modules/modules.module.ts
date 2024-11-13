import { Module } from '@nestjs/common';
import { ProductsModule } from './products/products.module';
import { UsersModule } from './users/users.module';
import { SellerModule } from './seller/seller.module';

@Module({
  imports: [ProductsModule, UsersModule, SellerModule],
})
export class ModulesModule {}
