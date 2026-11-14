import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quiz cá nhân do học viên tự chọn phạm vi bài học (AI ra đề theo các bài đã chọn).
 *
 * - `personal_user_id`: chủ của quiz — chỉ người này thấy/làm; `NULL` = quiz chung của khoá.
 * - `scope_lesson_ids`: danh sách `lessons.id` học viên đã chọn làm phạm vi đề.
 */
export class AddPersonalQuizzes1795400000000 implements MigrationInterface {
	name = 'AddPersonalQuizzes1795400000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "quizzes" ADD "personal_user_id" uuid`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" ADD "scope_lesson_ids" jsonb`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_quizzes_course_personal" ON "quizzes" ("course_id", "personal_user_id")`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" ADD CONSTRAINT "fk_quizzes_personal_user" FOREIGN KEY ("personal_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "quizzes" DROP CONSTRAINT "fk_quizzes_personal_user"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_quizzes_course_personal"`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" DROP COLUMN "scope_lesson_ids"`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" DROP COLUMN "personal_user_id"`,
		);
	}
}
