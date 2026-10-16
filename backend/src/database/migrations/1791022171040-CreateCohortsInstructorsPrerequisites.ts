import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Thêm ba bảng ngoài baseline phục vụ E3 (và E2-T3 đã dời sang E3):
 * `cohorts`, `course_instructors`, `course_prerequisites` — cùng FK
 * `enrollments.cohort_id → cohorts(id)` (trước đây là cột uuid trần, xem TODO đã gỡ trong
 * `enrollment.entity.ts`).
 *
 * DDL do `npm run migration:generate` sinh (quy ước database-design §9.2), phần **chỉnh tay** ở
 * cuối `up()` là hai index mà TypeORM không biểu diễn được:
 * - `uq_cohorts_course_class`: partial unique (`WHERE class_code IS NOT NULL`).
 * - `uq_course_instructors_course_user_cohort`: unique trên **biểu thức**
 *   `COALESCE(cohort_id, '000…0')` — cần thiết vì Postgres coi mỗi `NULL` là khác nhau, nên
 *   UNIQUE ba cột thô sẽ cho phép chèn trùng phân công "cả khoá" nhiều lần (§3.2.3).
 */
export class CreateCohortsInstructorsPrerequisites1791022171040 implements MigrationInterface {
	name = 'CreateCohortsInstructorsPrerequisites1791022171040';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "cohorts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "course_id" uuid NOT NULL, "group_code" character varying(50), "class_code" character varying(50), "name" character varying(150) NOT NULL, "semester" character varying(20), "starts_on" date, "ends_on" date, CONSTRAINT "chk_cohorts_dates" CHECK ("ends_on" IS NULL OR "starts_on" IS NULL OR "ends_on" >= "starts_on"), CONSTRAINT "PK_fd38f76b135e907b834fda1e752" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "course_prerequisites" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "course_id" uuid NOT NULL, "prerequisite_course_id" uuid NOT NULL, CONSTRAINT "chk_course_prerequisites_not_self" CHECK ("course_id" <> "prerequisite_course_id"), CONSTRAINT "PK_ec67ec01a08ed9a2bf27670bc9e" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_course_prerequisites_pair" ON "course_prerequisites" ("course_id", "prerequisite_course_id") `,
		);
		await queryRunner.query(
			`CREATE TABLE "course_instructors" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "course_id" uuid NOT NULL, "user_id" uuid NOT NULL, "cohort_id" uuid, "role_in_course" character varying(20) NOT NULL DEFAULT 'co_instructor', "assigned_by" uuid, "assigned_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), CONSTRAINT "chk_course_instructors_role" CHECK ("role_in_course" IN ('owner', 'co_instructor', 'assistant')), CONSTRAINT "PK_bc1d7eab424e6bd80d06f7a9282" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_course_instructors_cohort" ON "course_instructors" ("cohort_id") `,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_course_instructors_user" ON "course_instructors" ("user_id") `,
		);
		await queryRunner.query(
			`ALTER TABLE "cohorts" ADD CONSTRAINT "FK_f4228ff8a867fe9bdc7fe5d07ee" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "enrollments" ADD CONSTRAINT "FK_66dbba19e66e25c3814f80b6478" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "course_prerequisites" ADD CONSTRAINT "FK_2caff7cd02b6e0bb6f87a7b7ac4" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "course_prerequisites" ADD CONSTRAINT "FK_6a62e500916ac616079b7bc0b3f" FOREIGN KEY ("prerequisite_course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "course_instructors" ADD CONSTRAINT "FK_ff1fe7ba07418a03281c94fac46" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "course_instructors" ADD CONSTRAINT "FK_c204a45ca0de73f6b7d2d0f9442" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "course_instructors" ADD CONSTRAINT "FK_b2996a2aca29ad8750f5877d2b0" FOREIGN KEY ("cohort_id") REFERENCES "cohorts"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "course_instructors" ADD CONSTRAINT "FK_b15345de38812791be9fbc96bd4" FOREIGN KEY ("assigned_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);

		// --- Chỉnh tay: index TypeORM không biểu diễn được (xem docblock đầu file) ------------
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_cohorts_course_class" ON "cohorts" ("course_id", "class_code") WHERE "class_code" IS NOT NULL`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_course_instructors_course_user_cohort" ON "course_instructors" ("course_id", "user_id", COALESCE("cohort_id", '00000000-0000-0000-0000-000000000000'::uuid))`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// --- Chỉnh tay: dọn dữ liệu tham chiếu trước khi bỏ bảng --------------------------------
		// `enrollments.cohort_id` là cột **có sẵn từ baseline** (E3 chỉ thêm FK cho nó). Nếu `down()`
		// xoá bảng `cohorts` mà để nguyên giá trị trong cột, các giá trị đó thành mồ côi và lần
		// `up()` kế tiếp **thất bại** ở `ADD CONSTRAINT` với `23503` — tức chu trình `up → revert →
		// up` của CI chỉ chạy được trên DB rỗng, còn trên máy dev có dữ liệu seed thì hỏng (đã xảy ra
		// thật khi kiểm chứng E3). Xoá bảng lớp thì việc mất thông tin lớp là không tránh khỏi, nên
		// đặt `NULL` là hành vi đúng và làm cho migration lùi được an toàn.
		await queryRunner.query(
			`UPDATE "enrollments" SET "cohort_id" = NULL WHERE "cohort_id" IS NOT NULL`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."uq_course_instructors_course_user_cohort"`,
		);
		await queryRunner.query(`DROP INDEX "public"."uq_cohorts_course_class"`);
		await queryRunner.query(
			`ALTER TABLE "course_instructors" DROP CONSTRAINT "FK_b15345de38812791be9fbc96bd4"`,
		);
		await queryRunner.query(
			`ALTER TABLE "course_instructors" DROP CONSTRAINT "FK_b2996a2aca29ad8750f5877d2b0"`,
		);
		await queryRunner.query(
			`ALTER TABLE "course_instructors" DROP CONSTRAINT "FK_c204a45ca0de73f6b7d2d0f9442"`,
		);
		await queryRunner.query(
			`ALTER TABLE "course_instructors" DROP CONSTRAINT "FK_ff1fe7ba07418a03281c94fac46"`,
		);
		await queryRunner.query(
			`ALTER TABLE "course_prerequisites" DROP CONSTRAINT "FK_6a62e500916ac616079b7bc0b3f"`,
		);
		await queryRunner.query(
			`ALTER TABLE "course_prerequisites" DROP CONSTRAINT "FK_2caff7cd02b6e0bb6f87a7b7ac4"`,
		);
		await queryRunner.query(
			`ALTER TABLE "enrollments" DROP CONSTRAINT "FK_66dbba19e66e25c3814f80b6478"`,
		);
		await queryRunner.query(
			`ALTER TABLE "cohorts" DROP CONSTRAINT "FK_f4228ff8a867fe9bdc7fe5d07ee"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_course_instructors_user"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_course_instructors_cohort"`,
		);
		await queryRunner.query(`DROP TABLE "course_instructors"`);
		await queryRunner.query(
			`DROP INDEX "public"."uq_course_prerequisites_pair"`,
		);
		await queryRunner.query(`DROP TABLE "course_prerequisites"`);
		await queryRunner.query(`DROP TABLE "cohorts"`);
	}
}
