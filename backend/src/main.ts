import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import {
	BadRequestException,
	ValidationError,
	ValidationPipe,
} from '@nestjs/common';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { ApiResponseDto } from './common/dto/api-response.dto';

const flattenValidationErrors = (
	errors: ValidationError[],
	parentPath = '',
): string[] => {
	const messages: string[] = [];

	for (const error of errors) {
		const currentPath = parentPath
			? `${parentPath}.${error.property}`
			: error.property;

		if (error.constraints) {
			messages.push(
				...Object.values(error.constraints).map((c) => `${currentPath}: ${c}`),
			);
		}

		if (error.children?.length) {
			messages.push(...flattenValidationErrors(error.children, currentPath));
		}
	}

	return messages;
};

async function bootstrap() {
	const app = await NestFactory.create(AppModule);
	app.setGlobalPrefix('api');

	const configService = app.get(ConfigService);

	const rawOrigins = configService.get<string>('CORS_ORIGINS', '');
	const originList = rawOrigins
		.split(',')
		.map((o) => o.trim())
		.filter((o) => !!o);

	app.enableCors({
		origin: (
			origin: string | undefined,
			callback: (err: Error | null, allow?: boolean) => void,
		) => {
			if (!origin || originList.includes(origin)) {
				callback(null, true);
				return;
			}
			callback(null, false);
		},
		credentials: true,
	});

	app.useGlobalPipes(
		new ValidationPipe({
			transform: true,
			whitelist: true,
			exceptionFactory: (errors: ValidationError[] = []) => {
				const validationErrors = flattenValidationErrors(errors);
				return new BadRequestException({
					message:
						validationErrors.length > 0
							? validationErrors
							: ['Dữ liệu gửi lên không hợp lệ.'],
					error: 'Yêu cầu không hợp lệ',
				});
			},
		}),
	);

	app.useGlobalInterceptors(new TransformResponseInterceptor());
	app.useGlobalFilters(new AllExceptionsFilter());

	const swaggerConfig = new DocumentBuilder()
		.setTitle(configService.get<string>('SWAGGER_TITLE', 'UniPrep API'))
		.setDescription(
			configService.get<string>(
				'SWAGGER_DESCRIPTION',
				'UniPrep API documentation',
			),
		)
		.setVersion(configService.get<string>('SWAGGER_VERSION', '1.0'))
		.addBearerAuth()
		.build();
	const document = SwaggerModule.createDocument(app, swaggerConfig, {
		extraModels: [ApiResponseDto],
	});
	const swaggerPath = 'docs';
	SwaggerModule.setup(swaggerPath, app, document, {
		swaggerOptions: { persistAuthorization: true },
	});

	const port = configService.get<number>('PORT') || 3000;
	await app.listen(port);
	console.log(`Server đang chạy tại http://localhost:${port}`);
	console.log(
		`Swagger docs available at http://localhost:${port}/${swaggerPath}`,
	);
}
bootstrap().catch((err) => {
	console.error('Không thể khởi động ứng dụng', err);
	process.exit(1);
});
