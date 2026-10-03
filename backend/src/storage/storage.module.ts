import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { StorageService } from './storage.service';

/**
 * Module lưu trữ tệp (E3-T4).
 *
 * `@Global()` có chủ đích: `StorageService` là hạ tầng dùng chung (không giữ trạng thái nghiệp vụ)
 * và `LessonModule` **bắt buộc** import nó theo yêu cầu task, nhưng khai báo global giúp các module
 * sau (E12 xuất báo cáo, E4 import đề) không phải sửa `imports` chỉ để ghi một tệp — mỗi lần sửa
 * `imports` là một lần có nguy cơ tạo vòng phụ thuộc module.
 *
 * `imports: [ConfigModule]` **không** thừa dù `AppModule` đã gọi `ConfigModule.forRoot({ isGlobal:
 * true })`: `StorageService` đọc `UPLOAD_DIR`/`MAX_UPLOAD_SIZE_MB`/`PUBLIC_BASE_URL` nên nó phải
 * khai báo phụ thuộc của chính mình. Không có dòng này, module sẽ chỉ khởi tạo được khi `AppModule`
 * tình cờ đã nạp `ConfigModule` — biểu hiện là lỗi DI khó hiểu ("Nest can't resolve dependencies of
 * the StorageService (?)") khi test riêng `LessonModule` hoặc khi module này được tái sử dụng ở E12.
 * `ConfigModule` là module toàn cục đã chuẩn hoá của Nest nên import lại không tạo vòng.
 */
@Global()
@Module({
	imports: [ConfigModule],
	providers: [StorageService],
	exports: [StorageService],
})
export class StorageModule {}
