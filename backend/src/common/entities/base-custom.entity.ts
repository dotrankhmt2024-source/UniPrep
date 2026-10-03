import {
	PrimaryGeneratedColumn,
	CreateDateColumn,
	UpdateDateColumn,
} from 'typeorm';

/**
 * Entity cơ sở cho toàn bộ bảng nghiệp vụ.
 *
 * Tên cột được ghi rõ là snake_case: dự án dùng quy ước snake_case cho Postgres
 * (xem `docs/02-specs/database-design.md` §1.1) và KHÔNG cấu hình
 * `SnakeNamingStrategy`, nên nếu bỏ `name` thì TypeORM sẽ sinh cột `createdAt`/
 * `updatedAt` (camelCase), trộn hai kiểu đặt tên trong cùng một schema.
 */
export abstract class BaseEntityCustom {
	@PrimaryGeneratedColumn('uuid', { name: 'id' })
	id: string;

	@CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
	createdAt: Date;

	@UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
	updatedAt: Date;
}
