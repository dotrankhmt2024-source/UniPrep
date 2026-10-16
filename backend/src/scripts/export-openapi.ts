import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule } from '@nestjs/swagger';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { AppModule } from '../app.module';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { buildSwaggerConfig } from '../config/swagger.config';

/**
 * Xuất tài liệu OpenAPI của API thật ra `backend/openapi.json`:
 *
 *     npm run openapi:export
 *
 * Cần Postgres đang chạy vì `AppModule` mở kết nối TypeORM ngay khi khởi tạo —
 * script cố tình dùng đúng `AppModule` của ứng dụng (không dựng app giả) để tệp
 * xuất ra chắc chắn là mô tả của API đang chạy, không phải một bản chép tay.
 *
 * Quy ước: mỗi lần thêm/đổi endpoint, chạy lại lệnh này và commit `openapi.json`
 * cùng PR, để diff của tệp cho thấy API đã đổi những gì.
 */
async function exportOpenApi() {
	const app = await NestFactory.create(AppModule, { logger: false });
	app.setGlobalPrefix('api');

	const configService = app.get(ConfigService);
	const document = SwaggerModule.createDocument(
		app,
		buildSwaggerConfig(configService),
		{ extraModels: [ApiResponseDto] },
	);

	const outputPath = join(process.cwd(), 'openapi.json');
	writeFileSync(
		outputPath,
		`${JSON.stringify(document, null, '\t')}\n`,
		'utf8',
	);

	const pathCount = Object.keys(document.paths ?? {}).length;
	console.log(`Đã ghi ${outputPath} (${pathCount} đường dẫn API).`);

	await app.close();
}

exportOpenApi().catch((error) => {
	console.error('Không xuất được OpenAPI', error);
	process.exit(1);
});
