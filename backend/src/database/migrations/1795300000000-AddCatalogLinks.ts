import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Gắn khoá học/chương/bài/bài tập của UniPrep với nội dung môn học bên Catalog.
 *
 * - `courses.catalog_ref`        `CO1023@9.1` — khoá học được tạo từ đề cương (duy nhất).
 * - `course_sections.catalog_key` `CO1023@9.1#T3` — chương ứng với một chủ đề.
 * - `lessons.catalog_key`         `CO1023@9.1#3.4` — bài ứng với một kỹ năng (nội dung do AI sinh).
 * - `quizzes.catalog_key`         `CO1023@9.1#T3` — bài tập của chủ đề (câu hỏi do AI sinh).
 *
 * Cột rỗng = dữ liệu do giảng viên tự soạn như trước.
 */
export class AddCatalogLinks1795300000000 implements MigrationInterface {
	name = 'AddCatalogLinks1795300000000';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "courses" ADD "catalog_ref" character varying(80)`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_courses_catalog_ref" ON "courses" ("catalog_ref") WHERE "catalog_ref" IS NOT NULL`,
		);
		await queryRunner.query(
			`ALTER TABLE "course_sections" ADD "catalog_key" character varying(120)`,
		);
		await queryRunner.query(
			`ALTER TABLE "lessons" ADD "catalog_key" character varying(120)`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" ADD "catalog_key" character varying(120)`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(`ALTER TABLE "quizzes" DROP COLUMN "catalog_key"`);
		await queryRunner.query(`ALTER TABLE "lessons" DROP COLUMN "catalog_key"`);
		await queryRunner.query(
			`ALTER TABLE "course_sections" DROP COLUMN "catalog_key"`,
		);
		await queryRunner.query(`DROP INDEX "public"."uq_courses_catalog_ref"`);
		await queryRunner.query(`ALTER TABLE "courses" DROP COLUMN "catalog_ref"`);
	}
}
