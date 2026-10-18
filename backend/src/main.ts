import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import {
	BadRequestException,
	ValidationError,
	ValidationPipe,
} from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { resolve } from 'node:path';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { TransformResponseInterceptor } from './common/interceptors/transform-response.interceptor';
import { ApiResponseDto } from './common/dto/api-response.dto';
import { buildSwaggerConfig, SWAGGER_PATH } from './config/swagger.config';

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
	const app = await NestFactory.create<NestExpressApplication>(AppModule);
	app.setGlobalPrefix('api');

	const configService = app.get(ConfigService);

	/**
	 * Học liệu tải lên được phục vụ tĩnh tại `/uploads/lessons/**` (E3-T4).
	 *
	 * Vì sao **không** để dưới `/api`: đây là tệp, không phải endpoint nghiệp vụ — không đi qua
	 * `ValidationPipe`/interceptor envelope, và URL trả về cho FE (`fileUrl`) phải mở trực tiếp
	 * được trong thẻ `<video>`/`<img>`. `setGlobalPrefix('api')` không áp cho static assets.
	 *
	 * **Vì sao chỉ mount thư mục `lessons/`, không mount cả `UPLOAD_DIR`:** từ E5, `UPLOAD_DIR` còn
	 * chứa `submissions/<submissionId>/` — bài làm cá nhân của học viên. `useStaticAssets` **không**
	 * đi qua guard nào, nên mount cả thư mục sẽ khiến `GET /uploads/submissions/…` trả tệp cho bất kỳ
	 * ai biết đường dẫn, vô hiệu hoá toàn bộ việc kiểm quyền ở
	 * `GET /api/submission-files/:id/{download,view}`. Đường dẫn học liệu **không đổi**: `storageKey`
	 * của học liệu luôn bắt đầu bằng `lessons/`, nên URL đã lưu trong `lesson_materials.url` vẫn mở
	 * được. Thêm loại tệp công khai mới thì phải mount thêm ở đây một cách có chủ đích.
	 *
	 * Cảnh báo vận hành: thư mục này **không** được commit (`backend/.gitignore` có `/uploads`).
	 * Trên môi trường nhiều máy, đĩa cục bộ không chia sẻ được — đó là câu hỏi mở số 3 của
	 * `api-specification.md` §13 (đĩa cục bộ so với object storage), và `.env` đã chọn đĩa cục bộ
	 * bằng `UPLOAD_DIR`.
	 */
	const uploadDir = configService.get<string>('UPLOAD_DIR') ?? './uploads';
	app.useStaticAssets(resolve(uploadDir, 'lessons'), {
		prefix: '/uploads/lessons/',
	});

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

	const document = SwaggerModule.createDocument(
		app,
		buildSwaggerConfig(configService),
		{
			extraModels: [ApiResponseDto],
		},
	);
	const swaggerPath = SWAGGER_PATH;
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
