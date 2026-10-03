import { ConfigService } from '@nestjs/config';
import { DocumentBuilder } from '@nestjs/swagger';

/**
 * Cấu hình Swagger dùng CHUNG cho `main.ts` (phục vụ tại `/docs`) và cho script
 * `npm run openapi:export` (xuất `openapi.json`).
 *
 * Vì sao tách ra: nếu mỗi nơi tự dựng `DocumentBuilder` thì tệp `openapi.json`
 * trong repo sẽ lệch dần so với Swagger thật tại `/docs` — đúng thứ mà E0-T11
 * cần tránh (FE và AI service đọc chung một nguồn).
 */
export const buildSwaggerConfig = (configService: ConfigService) =>
	new DocumentBuilder()
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

/** Đường dẫn Swagger UI, ví dụ `http://localhost:3000/docs`. */
export const SWAGGER_PATH = 'docs';
