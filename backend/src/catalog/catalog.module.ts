import { Module } from '@nestjs/common';
import { CatalogClient } from './catalog.client';
import { CatalogController } from './catalog.controller';
import { CatalogService } from './catalog.service';
import { PgCatalogClient } from './pg-catalog.client';

/**
 * Catalog service: nội dung môn học (đề cương, chuẩn đầu ra, buổi học, môn tiên quyết) từ DB
 * của trường. UniPrep chỉ đọc; dữ liệu người học luôn nằm trong DB của UniPrep.
 *
 * Module khác import `CatalogModule` rồi inject `CatalogService`. `CatalogClient` là hợp đồng
 * truy cập — đổi `useClass` sang một client HTTP nếu Catalog được tách thành service riêng.
 */
@Module({
	controllers: [CatalogController],
	providers: [
		CatalogService,
		{ provide: CatalogClient, useClass: PgCatalogClient },
	],
	exports: [CatalogService],
})
export class CatalogModule {}
