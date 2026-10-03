import 'reflect-metadata';
import 'dotenv/config';
import { DataSource } from 'typeorm';

/**
 * DataSource dùng cho TypeORM CLI (`migration:generate/run/revert`) và cho seed
 * script. Ứng dụng NestJS KHÔNG dùng file này — `app.module.ts` tự cấu hình
 * kết nối riêng, nhưng cả hai phải trỏ tới cùng `DB_*` trong `.env`.
 *
 * Vì sao tách riêng: CLI của TypeORM chạy ngoài Nest nên không có `ConfigService`;
 * đọc trực tiếp `process.env` (đã nạp qua `dotenv/config`) là cách duy nhất giữ
 * một nguồn cấu hình duy nhất mà không cần bootstrap cả ứng dụng.
 *
 * `synchronize` LUÔN là `false` (kể cả dev) — schema chỉ đổi qua migration, xem
 * `docs/02-specs/database-design.md` §9.
 */
export const AppDataSource = new DataSource({
	type: 'postgres',
	host: process.env.DB_HOST ?? 'localhost',
	port: Number(process.env.DB_PORT ?? 5432),
	username: process.env.DB_USERNAME ?? 'postgres',
	password: process.env.DB_PASSWORD ?? 'postgres',
	database: process.env.DB_NAME ?? 'uniprep',

	// Postgres 13+ có sẵn `gen_random_uuid()` trong core, không cần extension nào;
	// mặc định của TypeORM lại là `uuid-ossp` (uuid_generate_v4) nên phải ghi rõ.
	// Tài liệu thiết kế cũng ghi mặc định của `id` là `gen_random_uuid()` (§3).
	uuidExtension: 'pgcrypto',

	// Glob để cả ts-node (dev/CLI) và dist (migration trên máy deploy) đều chạy:
	// __dirname là src/database khi chạy .ts, là dist/database khi chạy .js.
	entities: [__dirname + '/../**/*.entity{.ts,.js}'],
	migrations: [__dirname + '/migrations/*{.ts,.js}'],
	migrationsTableName: 'typeorm_migrations',

	synchronize: false,
	migrationsRun: false,
	logging: ['error', 'warn', 'migration'],
});
