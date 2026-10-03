import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thêm bảng `password_reset_tokens` (E1-T4, database-design.md §3.1.3).
 *
 * Đây là migration **đầu tiên sau baseline**: bảng này nằm ngoài 25 bảng của E0 nên phải tạo bằng
 * migration mới, không được sửa `BaselineCoreSchema` đã chạy (quy tắc ở database-design.md §9.2).
 * DDL sinh bằng `npm run migration:generate`; phần đánh dấu bên dưới là chỉnh tay.
 */
export class AddPasswordResetTokens1791017471553 implements MigrationInterface {
	name = 'AddPasswordResetTokens1791017471553';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "password_reset_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "token_hash" character varying(255) NOT NULL, "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "used_at" TIMESTAMP WITH TIME ZONE, "requested_ip_hash" character varying(64), CONSTRAINT "PK_d16bebd73e844c48bca50ff8d3d" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_password_reset_tokens_token_hash" ON "password_reset_tokens" ("token_hash") `,
		);

		// --- Chỉnh tay: index có thứ tự cột DESC ------------------------------------------------
		// TypeORM không biểu diễn được `ORDER BY` trong decorator `@Index`, nên index này được
		// khai báo với `{ synchronize: false }` trong entity và tạo thủ công ở đây. Truy vấn cần
		// nó là "token mới nhất của người dùng" (`WHERE user_id = ? ORDER BY expires_at DESC`) —
		// index ASC vẫn dùng được nhưng phải đọc ngược, còn index DESC khớp thẳng thứ tự cần lấy.
		await queryRunner.query(
			`CREATE INDEX "idx_password_reset_tokens_user" ON "password_reset_tokens" ("user_id", "expires_at" DESC)`,
		);

		await queryRunner.query(
			`ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "FK_52ac39dd8a28730c63aeb428c9c" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "password_reset_tokens" DROP CONSTRAINT "FK_52ac39dd8a28730c63aeb428c9c"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_password_reset_tokens_user"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."uq_password_reset_tokens_token_hash"`,
		);
		await queryRunner.query(`DROP TABLE "password_reset_tokens"`);
	}
}
