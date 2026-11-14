import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTutorSessionsAndSteps1794644781170 implements MigrationInterface {
	name = 'AddTutorSessionsAndSteps1794644781170';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "tutor_sessions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "course_id" uuid NOT NULL, "title" character varying(120) NOT NULL, "model" character varying(80) NOT NULL, "context_lesson_id" uuid, CONSTRAINT "PK_39f9a9db240cb05398de875409f" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_tutor_sessions_user_updated" ON "tutor_sessions" ("user_id", "updated_at") `,
		);
		await queryRunner.query(
			`CREATE TABLE "tutor_steps" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "session_id" uuid NOT NULL, "turn" integer NOT NULL, "seq" integer NOT NULL, "role" character varying(20) NOT NULL, "content" text, "reasoning" text, "tool_calls" jsonb, "tool_call_id" character varying(100), "tool_name" character varying(100), "tool_args" jsonb, "data" jsonb, "prompt_tokens" integer, "completion_tokens" integer, "cache_hit_tokens" integer, "duration_ms" integer, CONSTRAINT "chk_tutor_steps_role" CHECK ("role" IN ('system', 'context', 'user', 'assistant', 'tool', 'answer', 'error')), CONSTRAINT "PK_c3b1e3b72367176c633ce80f8c4" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_tutor_steps_session_seq" ON "tutor_steps" ("session_id", "seq") `,
		);
		await queryRunner.query(
			`ALTER TABLE "tutor_sessions" ADD CONSTRAINT "FK_23baf524dd89c16ebb199e2a5b1" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "tutor_sessions" ADD CONSTRAINT "FK_da4074955e3022479886178022e" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "tutor_steps" ADD CONSTRAINT "FK_1eaab6b98954aa7bf2ca3cfdb21" FOREIGN KEY ("session_id") REFERENCES "tutor_sessions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`ALTER TABLE "tutor_steps" DROP CONSTRAINT "FK_1eaab6b98954aa7bf2ca3cfdb21"`,
		);
		await queryRunner.query(
			`ALTER TABLE "tutor_sessions" DROP CONSTRAINT "FK_da4074955e3022479886178022e"`,
		);
		await queryRunner.query(
			`ALTER TABLE "tutor_sessions" DROP CONSTRAINT "FK_23baf524dd89c16ebb199e2a5b1"`,
		);
		await queryRunner.query(`DROP INDEX "public"."uq_tutor_steps_session_seq"`);
		await queryRunner.query(`DROP TABLE "tutor_steps"`);
		await queryRunner.query(
			`DROP INDEX "public"."idx_tutor_sessions_user_updated"`,
		);
		await queryRunner.query(`DROP TABLE "tutor_sessions"`);
	}
}
