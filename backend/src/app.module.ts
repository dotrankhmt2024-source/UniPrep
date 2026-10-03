import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { HealthModule } from './health/health.module';

@Module({
	imports: [
		ConfigModule.forRoot({
			isGlobal: true,
		}),
		TypeOrmModule.forRootAsync({
			imports: [ConfigModule],
			inject: [ConfigService],
			useFactory: (config: ConfigService) => ({
				type: 'postgres',
				host: config.get<string>('DB_HOST'),
				port: config.get<number>('DB_PORT'),
				username: config.get<string>('DB_USERNAME'),
				password: config.get<string>('DB_PASSWORD'),
				database: config.get<string>('DB_NAME'),
				uuidExtension: 'pgcrypto',
				autoLoadEntities: true,
				// Schema chỉ được đổi qua migration (xem src/database/data-source.ts và
				// docs/02-specs/database-design.md §9) — bật synchronize ở bất kỳ môi
				// trường nào cũng có thể xoá cột/dữ liệu ngoài ý muốn.
				synchronize: false,
				migrations: [__dirname + '/database/migrations/*{.ts,.js}'],
				migrationsTableName: 'typeorm_migrations',
				migrationsRun: false,
				logging: false,
			}),
		}),
		HealthModule,
	],
	controllers: [AppController],
	providers: [AppService],
})
export class AppModule {}
