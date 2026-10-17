import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Bổ sung "bài tập nộp tệp" (yêu cầu 4.4):
 *
 * - `submission_files`: tệp học viên đính kèm cho một lượt làm bài.
 * - `quizzes.submission_mode`: hình thức nộp `quiz` | `file` | `mixed`.
 * - `quizzes.max_score`: điểm tối đa của phần nộp tệp (bài không có câu hỏi nên không thể suy ra
 *   từ tổng điểm câu hỏi).
 *
 * DDL do `npm run migration:generate` sinh theo quy ước database-design §9.2; không có phần chỉnh
 * tay vì cả hai index của bảng mới đều biểu diễn được bằng `@Index` trên entity.
 *
 * `down()` xoá bảng trước khi gỡ cột của `quizzes`: hai phần độc lập nên thứ tự chỉ cần hợp lệ với
 * khoá ngoại (`submission_files` tham chiếu `submissions`, không tham chiếu `quizzes`).
 */
export class AddSubmissionFilesAndQuizMode1792164517382 implements MigrationInterface {
	name = 'AddSubmissionFilesAndQuizMode1792164517382';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "submission_files" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "submission_id" uuid NOT NULL, "uploaded_by" uuid, "original_name" character varying(255) NOT NULL, "storage_key" character varying(512) NOT NULL, "mime_type" character varying(100) NOT NULL, "file_size_bytes" bigint NOT NULL, CONSTRAINT "chk_submission_files_file_size_bytes" CHECK ("file_size_bytes" >= 0), CONSTRAINT "PK_5a50c4ff6bd91c77fe659c86b6f" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_submission_files_submission" ON "submission_files" ("submission_id") `,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_submission_files_storage_key" ON "submission_files" ("storage_key") `,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" ADD "submission_mode" character varying(20) NOT NULL DEFAULT 'quiz'`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" ADD "max_score" numeric(6,2)`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" ADD CONSTRAINT "chk_quizzes_max_score" CHECK ("max_score" IS NULL OR "max_score" > 0)`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" ADD CONSTRAINT "chk_quizzes_submission_mode" CHECK ("submission_mode" IN ('quiz', 'file', 'mixed'))`,
		);
		await queryRunner.query(
			`ALTER TABLE "submission_files" ADD CONSTRAINT "FK_2922aa3bbea583473e9b510618c" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "submission_files" ADD CONSTRAINT "FK_eae5d85344da2645707cbef1a56" FOREIGN KEY ("uploaded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "submission_files" DROP CONSTRAINT "FK_eae5d85344da2645707cbef1a56"`,
		);
		await queryRunner.query(
			`ALTER TABLE "submission_files" DROP CONSTRAINT "FK_2922aa3bbea583473e9b510618c"`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" DROP CONSTRAINT "chk_quizzes_submission_mode"`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" DROP CONSTRAINT "chk_quizzes_max_score"`,
		);
		await queryRunner.query(`ALTER TABLE "quizzes" DROP COLUMN "max_score"`);
		await queryRunner.query(
			`ALTER TABLE "quizzes" DROP COLUMN "submission_mode"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."uq_submission_files_storage_key"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_submission_files_submission"`,
		);
		await queryRunner.query(`DROP TABLE "submission_files"`);
	}
}
