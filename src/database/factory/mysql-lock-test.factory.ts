import { ConfigService } from '@nestjs/config';
import { Injectable, Logger } from '@nestjs/common';
import { TypeOrmModuleOptions, TypeOrmOptionsFactory } from '@nestjs/typeorm';

@Injectable()
export class MysqlLockTestFactory implements TypeOrmOptionsFactory {
  private readonly logger: Logger = new Logger(this.constructor.name);

  constructor(private readonly configService: ConfigService) {}

  createTypeOrmOptions(
    connectionName = 'default',
  ): Promise<TypeOrmModuleOptions> | TypeOrmModuleOptions {
    this.logger.debug(`connectionName: ${connectionName}`);

    return {
      type: 'mysql',
      name: connectionName,
      host: this.configService.get('DB_HOST'),
      port: this.configService.get('DB_PORT'),
      username: this.configService.get('DB_USERNAME'),
      password: this.configService.get('DB_PASSWORD'),
      database: this.configService.get('DB_NAME'),
      entities: [__dirname + '/../../modules/**/*.entity{.ts,.js}'],
      synchronize: this.configService.get('NODE_ENV') !== 'production',
      logging: this.configService.get('NODE_ENV') !== 'production',
      autoLoadEntities: true,
      migrationsRun: false,
      debug: false,
      extra: {
        connectionLimit:
          this.configService.get('NODE_ENV') !== 'production' ? 50 : 10,
      },
    };
  }
}
