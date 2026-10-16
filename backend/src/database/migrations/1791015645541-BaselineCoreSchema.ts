import { MigrationInterface, QueryRunner } from 'typeorm';

export class BaselineCoreSchema1791015645541 implements MigrationInterface {
	name = 'BaselineCoreSchema1791015645541';

	public async up(queryRunner: QueryRunner): Promise<void> {
		await queryRunner.query(
			`CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "email" character varying(255) NOT NULL, "password_hash" character varying(255) NOT NULL, "full_name" character varying(255) NOT NULL, "role" character varying(20) NOT NULL DEFAULT 'student', "status" character varying(20) NOT NULL DEFAULT 'pending', "phone" character varying(20), "avatar_url" character varying(512), "bio" text, "major" character varying(255), "student_code" character varying(50), "date_of_birth" date, "preferred_locale" character varying(10) NOT NULL DEFAULT 'vi', "email_verified_at" TIMESTAMP WITH TIME ZONE, "last_login_at" TIMESTAMP WITH TIME ZONE, "failed_login_count" smallint NOT NULL DEFAULT '0', "locked_until" TIMESTAMP WITH TIME ZONE, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_users_status" CHECK ("status" IN ('pending', 'active', 'suspended', 'disabled')), CONSTRAINT "chk_users_role" CHECK ("role" IN ('student', 'teacher', 'admin')), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_users_student_code" ON "users" ("student_code") WHERE "student_code" IS NOT NULL`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_users_role_status" ON "users" ("role", "status") `,
		);
		await queryRunner.query(
			`CREATE TABLE "notifications" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "notification_type" character varying(30) NOT NULL, "channel" character varying(20) NOT NULL DEFAULT 'in_app', "title" character varying(255) NOT NULL, "body" text NOT NULL, "payload" jsonb NOT NULL DEFAULT '{}', "related_type" character varying(30), "related_id" uuid, "is_read" boolean NOT NULL DEFAULT false, "read_at" TIMESTAMP WITH TIME ZONE, "sent_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "delivered_at" TIMESTAMP WITH TIME ZONE, "failed_reason" character varying(255), CONSTRAINT "chk_notifications_channel" CHECK ("channel" IN ('in_app', 'email', 'websocket')), CONSTRAINT "PK_6a72c3c0f683f6462415e653c3a" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "categories" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(150) NOT NULL, "slug" character varying(180) NOT NULL, "description" text, "parent_id" uuid, "order_index" integer NOT NULL DEFAULT '0', "is_active" boolean NOT NULL DEFAULT true, CONSTRAINT "PK_24dbc6126a28ff948da33e97d3b" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_categories_parent_order" ON "categories" ("parent_id", "order_index") `,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_categories_slug" ON "categories" ("slug") `,
		);
		await queryRunner.query(
			`CREATE TABLE "courses" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "code" character varying(50) NOT NULL, "title" character varying(255) NOT NULL, "slug" character varying(280) NOT NULL, "summary" character varying(500), "description" text, "category_id" uuid, "owner_id" uuid NOT NULL, "cover_url" character varying(512), "level" character varying(20), "language" character varying(10) NOT NULL DEFAULT 'vi', "semester" character varying(20), "status" character varying(20) NOT NULL DEFAULT 'draft', "visibility" character varying(20) NOT NULL DEFAULT 'public', "estimated_hours" numeric(5,1), "enrollment_open" boolean NOT NULL DEFAULT true, "max_students" integer, "published_at" TIMESTAMP WITH TIME ZONE, "archived_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_courses_visibility" CHECK ("visibility" IN ('public', 'unlisted', 'private')), CONSTRAINT "chk_courses_status" CHECK ("status" IN ('draft', 'published', 'hidden', 'archived')), CONSTRAINT "PK_3f70a487cc718ad8eda4e6d58c9" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_courses_owner" ON "courses" ("owner_id") `,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_courses_category_status" ON "courses" ("category_id", "status") `,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_courses_slug" ON "courses" ("slug") `,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_courses_code" ON "courses" ("code") `,
		);
		await queryRunner.query(
			`CREATE TABLE "enrollments" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "course_id" uuid NOT NULL, "cohort_id" uuid, "status" character varying(20) NOT NULL DEFAULT 'active', "source" character varying(20) NOT NULL DEFAULT 'self', "enrolled_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "started_at" TIMESTAMP WITH TIME ZONE, "last_activity_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "dropped_at" TIMESTAMP WITH TIME ZONE, "progress_percent" numeric(5,2) NOT NULL DEFAULT '0', "final_score" numeric(5,2), CONSTRAINT "chk_enrollments_progress_percent" CHECK ("progress_percent" BETWEEN 0 AND 100), CONSTRAINT "chk_enrollments_source" CHECK ("source" IN ('self', 'invited', 'admin')), CONSTRAINT "chk_enrollments_status" CHECK ("status" IN ('active', 'completed', 'dropped', 'expired')), CONSTRAINT "PK_7c0f752f9fb68bf6ed7367ab00f" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_enrollments_cohort" ON "enrollments" ("cohort_id") WHERE "cohort_id" IS NOT NULL`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_enrollments_course_status" ON "enrollments" ("course_id", "status") `,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_enrollments_user_course" ON "enrollments" ("user_id", "course_id") `,
		);
		await queryRunner.query(
			`CREATE TABLE "course_sections" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "course_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "description" text, "order_index" integer NOT NULL, "is_published" boolean NOT NULL DEFAULT false, "published_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_03086ef0602f2721612a5ce610d" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_course_sections_course_order" ON "course_sections" ("course_id", "order_index") `,
		);
		await queryRunner.query(
			`CREATE TABLE "lessons" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "course_id" uuid NOT NULL, "section_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "slug" character varying(280) NOT NULL, "summary" character varying(500), "content" text, "content_format" character varying(20) NOT NULL DEFAULT 'markdown', "order_index" integer NOT NULL, "estimated_minutes" integer, "available_from" TIMESTAMP WITH TIME ZONE, "due_at" TIMESTAMP WITH TIME ZONE, "is_published" boolean NOT NULL DEFAULT false, "published_at" TIMESTAMP WITH TIME ZONE, "created_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_lessons_content_format" CHECK ("content_format" IN ('markdown', 'html', 'tiptap_json')), CONSTRAINT "PK_9b9a8d455cac672d262d7275730" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_lessons_course_slug" ON "lessons" ("course_id", "slug") `,
		);
		await queryRunner.query(
			`CREATE TABLE "lesson_progress" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "enrollment_id" uuid NOT NULL, "user_id" uuid NOT NULL, "course_id" uuid NOT NULL, "lesson_id" uuid NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'not_started', "first_viewed_at" TIMESTAMP WITH TIME ZONE, "last_viewed_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "time_spent_seconds" integer NOT NULL DEFAULT '0', "last_position_seconds" integer, "view_count" integer NOT NULL DEFAULT '0', CONSTRAINT "chk_lesson_progress_time_spent_seconds" CHECK ("time_spent_seconds" >= 0), CONSTRAINT "chk_lesson_progress_status" CHECK ("status" IN ('not_started', 'in_progress', 'completed')), CONSTRAINT "PK_e6223ebbc5f8f5fce40e0193de1" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_lesson_progress_course_completed" ON "lesson_progress" ("course_id", "completed_at") WHERE "status" = 'completed'`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_lesson_progress_user_status" ON "lesson_progress" ("user_id", "status") `,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_lesson_progress_enrollment_lesson" ON "lesson_progress" ("enrollment_id", "lesson_id") `,
		);
		await queryRunner.query(
			`CREATE TABLE "lesson_materials" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "lesson_id" uuid NOT NULL, "material_type" character varying(20) NOT NULL, "title" character varying(255) NOT NULL, "content" text, "url" character varying(1024), "storage_key" character varying(512), "mime_type" character varying(100), "file_size_bytes" bigint, "duration_seconds" integer, "order_index" integer NOT NULL DEFAULT '0', "is_published" boolean NOT NULL DEFAULT true, CONSTRAINT "chk_lesson_materials_url_or_content" CHECK ("url" IS NOT NULL OR "content" IS NOT NULL), CONSTRAINT "chk_lesson_materials_duration_seconds" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0), CONSTRAINT "chk_lesson_materials_file_size_bytes" CHECK ("file_size_bytes" IS NULL OR "file_size_bytes" >= 0), CONSTRAINT "chk_lesson_materials_material_type" CHECK ("material_type" IN ('text', 'slide', 'video', 'file', 'link')), CONSTRAINT "PK_546aa37092097e45987093d7c4c" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "quizzes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "course_id" uuid NOT NULL, "lesson_id" uuid, "section_id" uuid, "title" character varying(255) NOT NULL, "description" text, "quiz_type" character varying(20) NOT NULL DEFAULT 'practice', "time_limit_seconds" integer, "max_attempts" integer, "pass_score" numeric(5,2), "shuffle_questions" boolean NOT NULL DEFAULT false, "show_answers_after" character varying(20) NOT NULL DEFAULT 'after_submit', "available_from" TIMESTAMP WITH TIME ZONE, "due_at" TIMESTAMP WITH TIME ZONE, "is_published" boolean NOT NULL DEFAULT false, "created_by" uuid, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "chk_quizzes_show_answers_after" CHECK ("show_answers_after" IN ('never', 'after_submit', 'after_due')), CONSTRAINT "chk_quizzes_time_limit_seconds" CHECK ("time_limit_seconds" IS NULL OR "time_limit_seconds" > 0), CONSTRAINT "chk_quizzes_quiz_type" CHECK ("quiz_type" IN ('practice', 'graded', 'placement')), CONSTRAINT "PK_b24f0f7662cf6b3a0e7dba0a1b4" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "learning_events" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "course_id" uuid, "lesson_id" uuid, "quiz_id" uuid, "enrollment_id" uuid, "event_type" character varying(40) NOT NULL, "occurred_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "received_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "session_id" uuid, "duration_seconds" integer, "ip_hash" character varying(64), "user_agent" character varying(512), "metadata" jsonb NOT NULL DEFAULT '{}', CONSTRAINT "chk_learning_events_duration_seconds" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0), CONSTRAINT "PK_ae528cc9815d53624aca51b2e54" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "model_versions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "name" character varying(100) NOT NULL, "version" character varying(30) NOT NULL, "algorithm" character varying(50) NOT NULL, "feature_list" jsonb NOT NULL DEFAULT '[]', "hyperparams" jsonb, "metrics" jsonb, "training_data_ref" character varying(512), "artifact_uri" character varying(512), "is_active" boolean NOT NULL DEFAULT false, "trained_at" TIMESTAMP WITH TIME ZONE, "activated_at" TIMESTAMP WITH TIME ZONE, "retired_at" TIMESTAMP WITH TIME ZONE, "notes" text, "created_by" uuid, CONSTRAINT "PK_77c0256872dcc26394dba4b87ec" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_model_versions_name_version" ON "model_versions" ("name", "version") `,
		);
		await queryRunner.query(
			`CREATE TABLE "ai_jobs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "job_type" character varying(40) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'queued', "bull_job_id" character varying(100), "queue_name" character varying(50) NOT NULL DEFAULT 'ai-jobs', "requested_by" uuid, "course_id" uuid, "target_user_id" uuid, "model_version_id" uuid, "payload" jsonb NOT NULL DEFAULT '{}', "result" jsonb, "error_message" text, "attempts" smallint NOT NULL DEFAULT '0', "max_attempts" smallint NOT NULL DEFAULT '3', "priority" smallint NOT NULL DEFAULT '0', "scheduled_at" TIMESTAMP WITH TIME ZONE, "queued_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "started_at" TIMESTAMP WITH TIME ZONE, "finished_at" TIMESTAMP WITH TIME ZONE, "duration_ms" integer, CONSTRAINT "chk_ai_jobs_status" CHECK ("status" IN ('queued', 'running', 'succeeded', 'failed', 'cancelled')), CONSTRAINT "PK_895e59e4adb993a3f45dacb1d6b" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_ai_jobs_type_status" ON "ai_jobs" ("job_type", "status") `,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_ai_jobs_status_queued" ON "ai_jobs" ("status", "queued_at") `,
		);
		await queryRunner.query(
			`CREATE TABLE "risk_predictions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "course_id" uuid, "enrollment_id" uuid, "model_version_id" uuid NOT NULL, "ai_job_id" uuid, "risk_score" numeric(5,4) NOT NULL, "risk_level" character varying(10) NOT NULL, "is_at_risk" boolean NOT NULL DEFAULT false, "feature_snapshot" jsonb NOT NULL DEFAULT '{}', "explanation_summary" text, "horizon_days" integer NOT NULL DEFAULT '14', "computed_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "is_current" boolean NOT NULL DEFAULT true, "triggered_by" character varying(20) NOT NULL DEFAULT 'schedule', CONSTRAINT "chk_risk_predictions_triggered_by" CHECK ("triggered_by" IN ('schedule', 'manual', 'event')), CONSTRAINT "chk_risk_predictions_risk_level" CHECK ("risk_level" IN ('low', 'medium', 'high')), CONSTRAINT "chk_risk_predictions_risk_score" CHECK ("risk_score" >= 0 AND "risk_score" <= 1), CONSTRAINT "PK_3a6d982caa625c0701f08a29396" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "interventions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "course_id" uuid NOT NULL, "user_id" uuid NOT NULL, "instructor_id" uuid, "risk_prediction_id" uuid, "enrollment_id" uuid, "intervention_type" character varying(30) NOT NULL, "channel" character varying(20) NOT NULL DEFAULT 'in_app', "title" character varying(255) NOT NULL, "content" text NOT NULL, "recommended_lesson_ids" uuid array, "status" character varying(20) NOT NULL DEFAULT 'draft', "sent_at" TIMESTAMP WITH TIME ZONE, "acknowledged_at" TIMESTAMP WITH TIME ZONE, "completed_at" TIMESTAMP WITH TIME ZONE, "outcome" character varying(20), "outcome_note" text, "created_by" uuid, CONSTRAINT "chk_interventions_outcome" CHECK ("outcome" IS NULL OR "outcome" IN ('improved', 'no_change', 'worsened', 'unknown')), CONSTRAINT "chk_interventions_status" CHECK ("status" IN ('draft', 'sent', 'acknowledged', 'completed', 'cancelled')), CONSTRAINT "chk_interventions_channel" CHECK ("channel" IN ('in_app', 'email', 'websocket')), CONSTRAINT "chk_interventions_intervention_type" CHECK ("intervention_type" IN ('in_app_message', 'email_reminder', 'recommended_lesson', 'mentor_assignment', 'manual_note')), CONSTRAINT "PK_39babe074cbaa90750582bfc38d" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_interventions_course_status" ON "interventions" ("course_id", "status") `,
		);
		await queryRunner.query(
			`CREATE TABLE "submissions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "quiz_id" uuid NOT NULL, "user_id" uuid NOT NULL, "enrollment_id" uuid NOT NULL, "course_id" uuid NOT NULL, "attempt_no" integer NOT NULL DEFAULT '1', "status" character varying(20) NOT NULL DEFAULT 'in_progress', "score" numeric(6,2), "max_score" numeric(6,2), "correct_count" integer, "total_questions" integer, "started_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "submitted_at" TIMESTAMP WITH TIME ZONE, "graded_at" TIMESTAMP WITH TIME ZONE, "duration_seconds" integer, "graded_by" uuid, "feedback" text, "feedback_at" TIMESTAMP WITH TIME ZONE, "is_late" boolean NOT NULL DEFAULT false, CONSTRAINT "chk_submissions_duration_seconds" CHECK ("duration_seconds" IS NULL OR "duration_seconds" >= 0), CONSTRAINT "chk_submissions_status" CHECK ("status" IN ('in_progress', 'submitted', 'graded', 'expired')), CONSTRAINT "chk_submissions_attempt_no" CHECK ("attempt_no" >= 1), CONSTRAINT "PK_10b3be95b8b2fb1e482e07d706b" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_submissions_attempt" ON "submissions" ("quiz_id", "user_id", "attempt_no") `,
		);
		await queryRunner.query(
			`CREATE TABLE "quiz_questions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "quiz_id" uuid NOT NULL, "question_type" character varying(25) NOT NULL, "content" text NOT NULL, "explanation" text, "points" numeric(5,2) NOT NULL DEFAULT '1', "order_index" integer NOT NULL, CONSTRAINT "chk_quiz_questions_points" CHECK ("points" >= 0), CONSTRAINT "chk_quiz_questions_question_type" CHECK ("question_type" IN ('single_choice', 'multiple_choice', 'true_false', 'short_answer', 'essay')), CONSTRAINT "PK_ec0447fd30d9f5c182e7653bfd3" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_quiz_questions_quiz_order" ON "quiz_questions" ("quiz_id", "order_index") `,
		);
		await queryRunner.query(
			`CREATE TABLE "submission_answers" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "submission_id" uuid NOT NULL, "question_id" uuid NOT NULL, "selected_option_ids" uuid array, "answer_text" text, "is_correct" boolean, "points_awarded" numeric(5,2), "time_spent_seconds" integer, "feedback" text, CONSTRAINT "PK_32d8f1ef26cf32a2e8ba2f1fc13" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_submission_answers_question" ON "submission_answers" ("submission_id", "question_id") `,
		);
		await queryRunner.query(
			`CREATE TABLE "quiz_options" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "question_id" uuid NOT NULL, "content" text NOT NULL, "is_correct" boolean NOT NULL DEFAULT false, "order_index" integer NOT NULL DEFAULT '0', CONSTRAINT "PK_9c59607f100085ab17f0f138926" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "discussion_threads" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "course_id" uuid NOT NULL, "lesson_id" uuid, "author_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "body" text NOT NULL, "is_pinned" boolean NOT NULL DEFAULT false, "is_locked" boolean NOT NULL DEFAULT false, "is_hidden" boolean NOT NULL DEFAULT false, "hidden_by" uuid, "hidden_reason" character varying(255), "post_count" integer NOT NULL DEFAULT '0', "last_post_at" TIMESTAMP WITH TIME ZONE, "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_a818837c00396f71200df3103f8" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "discussion_posts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "thread_id" uuid NOT NULL, "author_id" uuid NOT NULL, "parent_post_id" uuid, "body" text NOT NULL, "is_hidden" boolean NOT NULL DEFAULT false, "hidden_by" uuid, "hidden_reason" character varying(255), "deleted_at" TIMESTAMP WITH TIME ZONE, CONSTRAINT "PK_1bfc0860cd9175674a2b7983833" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_discussion_posts_thread_time" ON "discussion_posts" ("thread_id", "created_at") `,
		);
		await queryRunner.query(
			`CREATE TABLE "refresh_tokens" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "user_id" uuid NOT NULL, "token_hash" character varying(255) NOT NULL, "family_id" uuid NOT NULL, "issued_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL, "revoked_at" TIMESTAMP WITH TIME ZONE, "revoked_reason" character varying(100), "replaced_by_token_id" uuid, "ip_hash" character varying(64), "user_agent" character varying(512), CONSTRAINT "chk_refresh_tokens_expires_at" CHECK ("expires_at" > "issued_at"), CONSTRAINT "PK_7d8bee0204106019488c4c50ffa" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_refresh_tokens_token_hash" ON "refresh_tokens" ("token_hash") `,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens" ("family_id") `,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_refresh_tokens_user_active" ON "refresh_tokens" ("user_id", "expires_at") WHERE "revoked_at" IS NULL`,
		);
		await queryRunner.query(
			`CREATE TABLE "audit_logs" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "actor_id" uuid, "actor_role" character varying(20), "action" character varying(60) NOT NULL, "entity_type" character varying(50) NOT NULL, "entity_id" uuid, "before_data" jsonb, "after_data" jsonb, "ip_hash" character varying(64), "user_agent" character varying(512), "request_id" uuid, "status" character varying(20) NOT NULL DEFAULT 'success', CONSTRAINT "chk_audit_logs_status" CHECK ("status" IN ('success', 'failure')), CONSTRAINT "PK_1bb179d048bbc581caa3b013439" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE TABLE "content_reports" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reporter_id" uuid NOT NULL, "target_type" character varying(25) NOT NULL, "target_id" uuid NOT NULL, "course_id" uuid, "reason" character varying(30) NOT NULL, "description" text, "status" character varying(20) NOT NULL DEFAULT 'pending', "reviewed_by" uuid, "reviewed_at" TIMESTAMP WITH TIME ZONE, "resolution_note" text, CONSTRAINT "chk_content_reports_status" CHECK ("status" IN ('pending', 'reviewing', 'resolved', 'rejected')), CONSTRAINT "chk_content_reports_reason" CHECK ("reason" IN ('spam', 'harassment', 'inappropriate', 'copyright', 'misinformation', 'other')), CONSTRAINT "chk_content_reports_target_type" CHECK ("target_type" IN ('discussion_thread', 'discussion_post', 'lesson', 'lesson_material', 'course')), CONSTRAINT "PK_6c59a68146cdde8de564ee649c1" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_content_reports_open" ON "content_reports" ("reporter_id", "target_type", "target_id") WHERE "status" IN ('pending', 'reviewing')`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_content_reports_target" ON "content_reports" ("target_type", "target_id") `,
		);
		await queryRunner.query(
			`CREATE TABLE "alert_settings" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "scope" character varying(20) NOT NULL DEFAULT 'global', "course_id" uuid, "threshold_medium" numeric(5,4) NOT NULL DEFAULT 0.4, "threshold_high" numeric(5,4) NOT NULL DEFAULT 0.7, "lookback_days" smallint NOT NULL DEFAULT '14', "inactivity_days" smallint NOT NULL DEFAULT '7', "min_events_for_prediction" smallint NOT NULL DEFAULT '5', "retry_attempt_threshold" smallint NOT NULL DEFAULT '3', "auto_intervention_enabled" boolean NOT NULL DEFAULT false, "notify_student" boolean NOT NULL DEFAULT true, "notify_instructor" boolean NOT NULL DEFAULT true, "schedule_cron" character varying(50) NOT NULL DEFAULT '0 2 * * *', "is_enabled" boolean NOT NULL DEFAULT true, "updated_by" uuid, CONSTRAINT "chk_alert_settings_threshold_high" CHECK ("threshold_high" >= "threshold_medium" AND "threshold_high" <= 1), CONSTRAINT "chk_alert_settings_threshold_medium" CHECK ("threshold_medium" >= 0 AND "threshold_medium" <= 1), CONSTRAINT "chk_alert_settings_scope" CHECK ("scope" IN ('global', 'course')), CONSTRAINT "PK_9f318561ba481069150ca1fff62" PRIMARY KEY ("id"))`,
		);
		await queryRunner.query(
			`ALTER TABLE "notifications" ADD CONSTRAINT "FK_9a8a82462cab47c73d25f49261f" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "categories" ADD CONSTRAINT "FK_88cea2dc9c31951d06437879b40" FOREIGN KEY ("parent_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "courses" ADD CONSTRAINT "FK_e4c260fe6bb1131707c4617f745" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "courses" ADD CONSTRAINT "FK_8e2bcdb457d982b1dc39e5e0edb" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "courses" ADD CONSTRAINT "FK_16fcd8ab8bc042688984d5b3934" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "enrollments" ADD CONSTRAINT "FK_ff997f5a39cd24a491b9aca45c9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "enrollments" ADD CONSTRAINT "FK_b79d0bf01779fdf9cfb6b092af3" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "course_sections" ADD CONSTRAINT "FK_348f9a7c13a6b413f10d2a1ef1a" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "lessons" ADD CONSTRAINT "FK_3c4e299cf8ed04093935e2e22fe" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "lessons" ADD CONSTRAINT "FK_19261e484ffd22b40ea596ece4d" FOREIGN KEY ("section_id") REFERENCES "course_sections"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "lessons" ADD CONSTRAINT "FK_b96adc7c3e06624edae3e0a01ae" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "lesson_progress" ADD CONSTRAINT "FK_2374c15822383f7e5362e27d417" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "lesson_progress" ADD CONSTRAINT "FK_0d9292b3eb40707950eeeba9617" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "lesson_progress" ADD CONSTRAINT "FK_112753761c2a01adab9677b717f" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "lesson_progress" ADD CONSTRAINT "FK_980e74721039ebe210fee2eeca2" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "lesson_materials" ADD CONSTRAINT "FK_f44de44451eef1e6cccdfc33042" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" ADD CONSTRAINT "FK_e460dcb813c2cc28c93c95f2504" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" ADD CONSTRAINT "FK_2cf4e4b5b533af8dc6b38d4fa9b" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" ADD CONSTRAINT "FK_09653811f5a4b031bec737a85a4" FOREIGN KEY ("section_id") REFERENCES "course_sections"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" ADD CONSTRAINT "FK_4eb3cacff4db73542f37b5a4358" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "learning_events" ADD CONSTRAINT "FK_906f38b0856b9ae7035ce1a3dce" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "learning_events" ADD CONSTRAINT "FK_6dbdc792d6424175f46a0721d85" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "learning_events" ADD CONSTRAINT "FK_e8af32b328391d3af736a0627bd" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "learning_events" ADD CONSTRAINT "FK_707ed8465d5d3d95a067d9d9723" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "learning_events" ADD CONSTRAINT "FK_6db7329e93fecb632484b38aaa4" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "model_versions" ADD CONSTRAINT "FK_7585095ea459166e2265cd0093a" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ai_jobs" ADD CONSTRAINT "FK_cc4b7c306600e13496c8f442520" FOREIGN KEY ("requested_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ai_jobs" ADD CONSTRAINT "FK_fa275a0311f99a81bf9a09777e1" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ai_jobs" ADD CONSTRAINT "FK_90134fd44e596072990bfa45ad1" FOREIGN KEY ("target_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "ai_jobs" ADD CONSTRAINT "FK_1393b324255ef7ef1325f5eab2e" FOREIGN KEY ("model_version_id") REFERENCES "model_versions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "risk_predictions" ADD CONSTRAINT "FK_64a8c1430676f1133d108dfe616" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "risk_predictions" ADD CONSTRAINT "FK_b5477fff404a52c030da9e3484d" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "risk_predictions" ADD CONSTRAINT "FK_24c30ed7db4924c26e5705dc910" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "risk_predictions" ADD CONSTRAINT "FK_b8737338af662d58830ba9766a5" FOREIGN KEY ("model_version_id") REFERENCES "model_versions"("id") ON DELETE RESTRICT ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "risk_predictions" ADD CONSTRAINT "FK_c87db990d94e15a5f98bfef4d23" FOREIGN KEY ("ai_job_id") REFERENCES "ai_jobs"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "interventions" ADD CONSTRAINT "FK_bfc0c3a7adab0cf5bc264d32d47" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "interventions" ADD CONSTRAINT "FK_b4519e72335e28694035cce7340" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "interventions" ADD CONSTRAINT "FK_4d70107d4a87ed592fe6e41771d" FOREIGN KEY ("instructor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "interventions" ADD CONSTRAINT "FK_1bf7b4a16885f4650617ca4439e" FOREIGN KEY ("risk_prediction_id") REFERENCES "risk_predictions"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "interventions" ADD CONSTRAINT "FK_b84fa1c1a95897eebe255ad0fb0" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "interventions" ADD CONSTRAINT "FK_01cd5ef6688c6aa75becdbe0b26" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "submissions" ADD CONSTRAINT "FK_f9a483997223e33e910fbdc8151" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "submissions" ADD CONSTRAINT "FK_fca12c4ddd646dea4572c6815a9" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "submissions" ADD CONSTRAINT "FK_5945f4f3d5e6a7fedd6680cc931" FOREIGN KEY ("enrollment_id") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "submissions" ADD CONSTRAINT "FK_6fc42b2f2983dd099fec7978444" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "submissions" ADD CONSTRAINT "FK_7e45a1f4ca37da761e5ae72046e" FOREIGN KEY ("graded_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "quiz_questions" ADD CONSTRAINT "FK_14c6d2b8f5be0bdb406a3895bb4" FOREIGN KEY ("quiz_id") REFERENCES "quizzes"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "submission_answers" ADD CONSTRAINT "FK_5b61c511ac5f89a1a8bcffe6cc3" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "submission_answers" ADD CONSTRAINT "FK_b65dfe2c68541fe7d90e82ebf03" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "quiz_options" ADD CONSTRAINT "FK_2aa44934a4602aef1ede068f4a7" FOREIGN KEY ("question_id") REFERENCES "quiz_questions"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_threads" ADD CONSTRAINT "FK_87ca03e6e7d50318a5313e56b35" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_threads" ADD CONSTRAINT "FK_d309da6173bf067d6b24439e136" FOREIGN KEY ("lesson_id") REFERENCES "lessons"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_threads" ADD CONSTRAINT "FK_6925ca722ce9ed3dbe63a123198" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_threads" ADD CONSTRAINT "FK_5c91e2947a85421cf30caa53644" FOREIGN KEY ("hidden_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_posts" ADD CONSTRAINT "FK_0b0950535a2571b4f375db7b4ae" FOREIGN KEY ("thread_id") REFERENCES "discussion_threads"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_posts" ADD CONSTRAINT "FK_5861d03c3859af8f7b40032ef08" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_posts" ADD CONSTRAINT "FK_f2c4196101d6a0e8d868ad00595" FOREIGN KEY ("parent_post_id") REFERENCES "discussion_posts"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_posts" ADD CONSTRAINT "FK_077271c0633980e6fdeeb2d5785" FOREIGN KEY ("hidden_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "refresh_tokens" ADD CONSTRAINT "FK_2df65cc5ccbeba13c4e1748ff85" FOREIGN KEY ("replaced_by_token_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "audit_logs" ADD CONSTRAINT "FK_177183f29f438c488b5e8510cdb" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "content_reports" ADD CONSTRAINT "FK_0aababfebc5662624a4a66b639b" FOREIGN KEY ("reporter_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "content_reports" ADD CONSTRAINT "FK_32fa5ac3cb02693b0a34e0c54a7" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "content_reports" ADD CONSTRAINT "FK_1d17bca2837c4dfd2657856d40e" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "alert_settings" ADD CONSTRAINT "FK_b37793d99b1c3a12fa1cc96d81a" FOREIGN KEY ("course_id") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
		);
		await queryRunner.query(
			`ALTER TABLE "alert_settings" ADD CONSTRAINT "FK_9c4e3c98dc8427413621cc27fde" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
		);

		// ---------------------------------------------------------------------
		// PHẦN VIẾT TAY (phần phía trên do `migration:generate` sinh).
		//
		// 1) Index có `DESC`, biểu thức (lower/COALESCE/to_tsvector) hoặc partial
		//    phức tạp mà TypeORM không biểu diễn được bằng decorator. Mỗi index có
		//    placeholder `@Index('<tên>', { synchronize: false })` trong entity
		//    tương ứng kèm DDL gốc trong comment — sửa index thì sửa cả hai chỗ.
		//    KHÔNG tạo `idx_learning_events_metadata_gin` (GIN trên jsonb) ở baseline:
		//    tài liệu §3.4.1 ghi rõ chỉ tạo khi thật sự có truy vấn theo khoá trong
		//    `metadata`, vì index GIN làm chậm ghi.
		// 2) Dọn bảng legacy `students` (xem cuối block).
		// ---------------------------------------------------------------------

		// Bắt buộc: đăng nhập không phân biệt hoa/thường (§4.1)
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_users_email_lower" ON "users" (lower("email"))`,
		);

		// Catalog khoá học
		await queryRunner.query(
			`CREATE INDEX "idx_courses_status_published" ON "courses" ("status", "published_at" DESC) WHERE "deleted_at" IS NULL`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_courses_search_tsv" ON "courses" USING GIN (to_tsvector('simple', "title" || ' ' || COALESCE("summary", '')))`,
		);

		// Lộ trình bài học
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_lessons_course_order" ON "lessons" ("course_id", "order_index") WHERE "deleted_at" IS NULL`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_lessons_course_order_published" ON "lessons" ("course_id", "order_index") WHERE "is_published" AND "deleted_at" IS NULL`,
		);

		// Ghi danh & bài nộp
		await queryRunner.query(
			`CREATE INDEX "idx_enrollments_user_active" ON "enrollments" ("user_id", "last_activity_at" DESC) WHERE "status" = 'active'`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_submissions_quiz_user" ON "submissions" ("quiz_id", "user_id", "attempt_no" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_submissions_user_time" ON "submissions" ("user_id", "submitted_at" DESC) WHERE "status" = 'graded'`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_submissions_course_time" ON "submissions" ("course_id", "submitted_at" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_discussion_posts_author_time" ON "discussion_posts" ("author_id", "created_at" DESC)`,
		);

		// Telemetry hành vi — phục vụ recency/feature của model (§4.4)
		await queryRunner.query(
			`CREATE INDEX "idx_learning_events_user_occurred" ON "learning_events" ("user_id", "occurred_at" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_learning_events_course_occurred" ON "learning_events" ("course_id", "occurred_at" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_learning_events_user_course_occurred" ON "learning_events" ("user_id", "course_id", "occurred_at" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_learning_events_type_occurred" ON "learning_events" ("event_type", "occurred_at" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_learning_events_lesson_occurred" ON "learning_events" ("lesson_id", "occurred_at" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_learning_events_logins" ON "learning_events" ("user_id", "occurred_at" DESC) WHERE "event_type" = 'login'`,
		);

		// Analytics & AI
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_model_versions_active" ON "model_versions" ("name") WHERE "is_active"`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_risk_predictions_current" ON "risk_predictions" ("user_id", COALESCE("course_id", '00000000-0000-0000-0000-000000000000'::uuid), "model_version_id") WHERE "is_current"`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_risk_predictions_course_level" ON "risk_predictions" ("course_id", "risk_level", "computed_at" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_risk_predictions_user_time" ON "risk_predictions" ("user_id", "computed_at" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_ai_jobs_course_time" ON "ai_jobs" ("course_id", "created_at" DESC)`,
		);

		// Can thiệp, thông báo, audit, kiểm duyệt
		await queryRunner.query(
			`CREATE INDEX "idx_interventions_user_time" ON "interventions" ("user_id", "created_at" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_interventions_instructor_time" ON "interventions" ("instructor_id", "created_at" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_notifications_unread" ON "notifications" ("user_id", "sent_at" DESC) WHERE "is_read" = false`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_notifications_user_time" ON "notifications" ("user_id", "sent_at" DESC)`,
		);
		await queryRunner.query(
			`CREATE UNIQUE INDEX "uq_alert_settings_scope" ON "alert_settings" ("scope", COALESCE("course_id", '00000000-0000-0000-0000-000000000000'::uuid))`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_audit_logs_entity" ON "audit_logs" ("entity_type", "entity_id", "created_at" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_audit_logs_actor" ON "audit_logs" ("actor_id", "created_at" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_audit_logs_action_time" ON "audit_logs" ("action", "created_at" DESC)`,
		);
		await queryRunner.query(
			`CREATE INDEX "idx_content_reports_status_time" ON "content_reports" ("status", "created_at" DESC)`,
		);

		// Dọn bảng legacy `students`: bảng này do `synchronize: true` sinh ra từ
		// module CRUD mẫu, KHÔNG thuộc ERD trong docs/02-specs/database-design.md
		// (schema thật dùng `users` + `enrollments`). Entity + `StudentModule` đã bị
		// xoá ở E0. `IF EXISTS` để DB dựng mới từ migration này vẫn chạy sạch.
		await queryRunner.query(`DROP TABLE IF EXISTS "students"`);
	}

	public async down(queryRunner: QueryRunner): Promise<void> {
		// Index viết tay (xem block tương ứng trong `up`) — phải drop trước khi drop bảng.
		await queryRunner.query(
			`DROP INDEX "public"."idx_content_reports_status_time"`,
		);
		await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_action_time"`);
		await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_actor"`);
		await queryRunner.query(`DROP INDEX "public"."idx_audit_logs_entity"`);
		await queryRunner.query(`DROP INDEX "public"."uq_alert_settings_scope"`);
		await queryRunner.query(
			`DROP INDEX "public"."idx_notifications_user_time"`,
		);
		await queryRunner.query(`DROP INDEX "public"."idx_notifications_unread"`);
		await queryRunner.query(
			`DROP INDEX "public"."idx_interventions_instructor_time"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_interventions_user_time"`,
		);
		await queryRunner.query(`DROP INDEX "public"."idx_ai_jobs_course_time"`);
		await queryRunner.query(
			`DROP INDEX "public"."idx_risk_predictions_user_time"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_risk_predictions_course_level"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."uq_risk_predictions_current"`,
		);
		await queryRunner.query(`DROP INDEX "public"."uq_model_versions_active"`);
		await queryRunner.query(`DROP INDEX "public"."idx_learning_events_logins"`);
		await queryRunner.query(
			`DROP INDEX "public"."idx_learning_events_lesson_occurred"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_learning_events_type_occurred"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_learning_events_user_course_occurred"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_learning_events_course_occurred"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_learning_events_user_occurred"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_discussion_posts_author_time"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_submissions_course_time"`,
		);
		await queryRunner.query(`DROP INDEX "public"."idx_submissions_user_time"`);
		await queryRunner.query(`DROP INDEX "public"."idx_submissions_quiz_user"`);
		await queryRunner.query(
			`DROP INDEX "public"."idx_enrollments_user_active"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_lessons_course_order_published"`,
		);
		await queryRunner.query(`DROP INDEX "public"."uq_lessons_course_order"`);
		await queryRunner.query(`DROP INDEX "public"."idx_courses_search_tsv"`);
		await queryRunner.query(
			`DROP INDEX "public"."idx_courses_status_published"`,
		);
		await queryRunner.query(`DROP INDEX "public"."uq_users_email_lower"`);
		// Bảng legacy `students` KHÔNG được khôi phục khi revert: dữ liệu trong đó chỉ
		// là dữ liệu mẫu và entity `Student` đã bị xoá, nên revert là no-op có chủ đích.
		await queryRunner.query(
			`ALTER TABLE "alert_settings" DROP CONSTRAINT "FK_9c4e3c98dc8427413621cc27fde"`,
		);
		await queryRunner.query(
			`ALTER TABLE "alert_settings" DROP CONSTRAINT "FK_b37793d99b1c3a12fa1cc96d81a"`,
		);
		await queryRunner.query(
			`ALTER TABLE "content_reports" DROP CONSTRAINT "FK_1d17bca2837c4dfd2657856d40e"`,
		);
		await queryRunner.query(
			`ALTER TABLE "content_reports" DROP CONSTRAINT "FK_32fa5ac3cb02693b0a34e0c54a7"`,
		);
		await queryRunner.query(
			`ALTER TABLE "content_reports" DROP CONSTRAINT "FK_0aababfebc5662624a4a66b639b"`,
		);
		await queryRunner.query(
			`ALTER TABLE "audit_logs" DROP CONSTRAINT "FK_177183f29f438c488b5e8510cdb"`,
		);
		await queryRunner.query(
			`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_2df65cc5ccbeba13c4e1748ff85"`,
		);
		await queryRunner.query(
			`ALTER TABLE "refresh_tokens" DROP CONSTRAINT "FK_3ddc983c5f7bcf132fd8732c3f4"`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_posts" DROP CONSTRAINT "FK_077271c0633980e6fdeeb2d5785"`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_posts" DROP CONSTRAINT "FK_f2c4196101d6a0e8d868ad00595"`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_posts" DROP CONSTRAINT "FK_5861d03c3859af8f7b40032ef08"`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_posts" DROP CONSTRAINT "FK_0b0950535a2571b4f375db7b4ae"`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_threads" DROP CONSTRAINT "FK_5c91e2947a85421cf30caa53644"`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_threads" DROP CONSTRAINT "FK_6925ca722ce9ed3dbe63a123198"`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_threads" DROP CONSTRAINT "FK_d309da6173bf067d6b24439e136"`,
		);
		await queryRunner.query(
			`ALTER TABLE "discussion_threads" DROP CONSTRAINT "FK_87ca03e6e7d50318a5313e56b35"`,
		);
		await queryRunner.query(
			`ALTER TABLE "quiz_options" DROP CONSTRAINT "FK_2aa44934a4602aef1ede068f4a7"`,
		);
		await queryRunner.query(
			`ALTER TABLE "submission_answers" DROP CONSTRAINT "FK_b65dfe2c68541fe7d90e82ebf03"`,
		);
		await queryRunner.query(
			`ALTER TABLE "submission_answers" DROP CONSTRAINT "FK_5b61c511ac5f89a1a8bcffe6cc3"`,
		);
		await queryRunner.query(
			`ALTER TABLE "quiz_questions" DROP CONSTRAINT "FK_14c6d2b8f5be0bdb406a3895bb4"`,
		);
		await queryRunner.query(
			`ALTER TABLE "submissions" DROP CONSTRAINT "FK_7e45a1f4ca37da761e5ae72046e"`,
		);
		await queryRunner.query(
			`ALTER TABLE "submissions" DROP CONSTRAINT "FK_6fc42b2f2983dd099fec7978444"`,
		);
		await queryRunner.query(
			`ALTER TABLE "submissions" DROP CONSTRAINT "FK_5945f4f3d5e6a7fedd6680cc931"`,
		);
		await queryRunner.query(
			`ALTER TABLE "submissions" DROP CONSTRAINT "FK_fca12c4ddd646dea4572c6815a9"`,
		);
		await queryRunner.query(
			`ALTER TABLE "submissions" DROP CONSTRAINT "FK_f9a483997223e33e910fbdc8151"`,
		);
		await queryRunner.query(
			`ALTER TABLE "interventions" DROP CONSTRAINT "FK_01cd5ef6688c6aa75becdbe0b26"`,
		);
		await queryRunner.query(
			`ALTER TABLE "interventions" DROP CONSTRAINT "FK_b84fa1c1a95897eebe255ad0fb0"`,
		);
		await queryRunner.query(
			`ALTER TABLE "interventions" DROP CONSTRAINT "FK_1bf7b4a16885f4650617ca4439e"`,
		);
		await queryRunner.query(
			`ALTER TABLE "interventions" DROP CONSTRAINT "FK_4d70107d4a87ed592fe6e41771d"`,
		);
		await queryRunner.query(
			`ALTER TABLE "interventions" DROP CONSTRAINT "FK_b4519e72335e28694035cce7340"`,
		);
		await queryRunner.query(
			`ALTER TABLE "interventions" DROP CONSTRAINT "FK_bfc0c3a7adab0cf5bc264d32d47"`,
		);
		await queryRunner.query(
			`ALTER TABLE "risk_predictions" DROP CONSTRAINT "FK_c87db990d94e15a5f98bfef4d23"`,
		);
		await queryRunner.query(
			`ALTER TABLE "risk_predictions" DROP CONSTRAINT "FK_b8737338af662d58830ba9766a5"`,
		);
		await queryRunner.query(
			`ALTER TABLE "risk_predictions" DROP CONSTRAINT "FK_24c30ed7db4924c26e5705dc910"`,
		);
		await queryRunner.query(
			`ALTER TABLE "risk_predictions" DROP CONSTRAINT "FK_b5477fff404a52c030da9e3484d"`,
		);
		await queryRunner.query(
			`ALTER TABLE "risk_predictions" DROP CONSTRAINT "FK_64a8c1430676f1133d108dfe616"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ai_jobs" DROP CONSTRAINT "FK_1393b324255ef7ef1325f5eab2e"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ai_jobs" DROP CONSTRAINT "FK_90134fd44e596072990bfa45ad1"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ai_jobs" DROP CONSTRAINT "FK_fa275a0311f99a81bf9a09777e1"`,
		);
		await queryRunner.query(
			`ALTER TABLE "ai_jobs" DROP CONSTRAINT "FK_cc4b7c306600e13496c8f442520"`,
		);
		await queryRunner.query(
			`ALTER TABLE "model_versions" DROP CONSTRAINT "FK_7585095ea459166e2265cd0093a"`,
		);
		await queryRunner.query(
			`ALTER TABLE "learning_events" DROP CONSTRAINT "FK_6db7329e93fecb632484b38aaa4"`,
		);
		await queryRunner.query(
			`ALTER TABLE "learning_events" DROP CONSTRAINT "FK_707ed8465d5d3d95a067d9d9723"`,
		);
		await queryRunner.query(
			`ALTER TABLE "learning_events" DROP CONSTRAINT "FK_e8af32b328391d3af736a0627bd"`,
		);
		await queryRunner.query(
			`ALTER TABLE "learning_events" DROP CONSTRAINT "FK_6dbdc792d6424175f46a0721d85"`,
		);
		await queryRunner.query(
			`ALTER TABLE "learning_events" DROP CONSTRAINT "FK_906f38b0856b9ae7035ce1a3dce"`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" DROP CONSTRAINT "FK_4eb3cacff4db73542f37b5a4358"`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" DROP CONSTRAINT "FK_09653811f5a4b031bec737a85a4"`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" DROP CONSTRAINT "FK_2cf4e4b5b533af8dc6b38d4fa9b"`,
		);
		await queryRunner.query(
			`ALTER TABLE "quizzes" DROP CONSTRAINT "FK_e460dcb813c2cc28c93c95f2504"`,
		);
		await queryRunner.query(
			`ALTER TABLE "lesson_materials" DROP CONSTRAINT "FK_f44de44451eef1e6cccdfc33042"`,
		);
		await queryRunner.query(
			`ALTER TABLE "lesson_progress" DROP CONSTRAINT "FK_980e74721039ebe210fee2eeca2"`,
		);
		await queryRunner.query(
			`ALTER TABLE "lesson_progress" DROP CONSTRAINT "FK_112753761c2a01adab9677b717f"`,
		);
		await queryRunner.query(
			`ALTER TABLE "lesson_progress" DROP CONSTRAINT "FK_0d9292b3eb40707950eeeba9617"`,
		);
		await queryRunner.query(
			`ALTER TABLE "lesson_progress" DROP CONSTRAINT "FK_2374c15822383f7e5362e27d417"`,
		);
		await queryRunner.query(
			`ALTER TABLE "lessons" DROP CONSTRAINT "FK_b96adc7c3e06624edae3e0a01ae"`,
		);
		await queryRunner.query(
			`ALTER TABLE "lessons" DROP CONSTRAINT "FK_19261e484ffd22b40ea596ece4d"`,
		);
		await queryRunner.query(
			`ALTER TABLE "lessons" DROP CONSTRAINT "FK_3c4e299cf8ed04093935e2e22fe"`,
		);
		await queryRunner.query(
			`ALTER TABLE "course_sections" DROP CONSTRAINT "FK_348f9a7c13a6b413f10d2a1ef1a"`,
		);
		await queryRunner.query(
			`ALTER TABLE "enrollments" DROP CONSTRAINT "FK_b79d0bf01779fdf9cfb6b092af3"`,
		);
		await queryRunner.query(
			`ALTER TABLE "enrollments" DROP CONSTRAINT "FK_ff997f5a39cd24a491b9aca45c9"`,
		);
		await queryRunner.query(
			`ALTER TABLE "courses" DROP CONSTRAINT "FK_16fcd8ab8bc042688984d5b3934"`,
		);
		await queryRunner.query(
			`ALTER TABLE "courses" DROP CONSTRAINT "FK_8e2bcdb457d982b1dc39e5e0edb"`,
		);
		await queryRunner.query(
			`ALTER TABLE "courses" DROP CONSTRAINT "FK_e4c260fe6bb1131707c4617f745"`,
		);
		await queryRunner.query(
			`ALTER TABLE "categories" DROP CONSTRAINT "FK_88cea2dc9c31951d06437879b40"`,
		);
		await queryRunner.query(
			`ALTER TABLE "notifications" DROP CONSTRAINT "FK_9a8a82462cab47c73d25f49261f"`,
		);
		await queryRunner.query(`DROP TABLE "alert_settings"`);
		await queryRunner.query(`DROP INDEX "public"."idx_content_reports_target"`);
		await queryRunner.query(`DROP INDEX "public"."uq_content_reports_open"`);
		await queryRunner.query(`DROP TABLE "content_reports"`);
		await queryRunner.query(`DROP TABLE "audit_logs"`);
		await queryRunner.query(
			`DROP INDEX "public"."idx_refresh_tokens_user_active"`,
		);
		await queryRunner.query(`DROP INDEX "public"."idx_refresh_tokens_family"`);
		await queryRunner.query(
			`DROP INDEX "public"."uq_refresh_tokens_token_hash"`,
		);
		await queryRunner.query(`DROP TABLE "refresh_tokens"`);
		await queryRunner.query(
			`DROP INDEX "public"."idx_discussion_posts_thread_time"`,
		);
		await queryRunner.query(`DROP TABLE "discussion_posts"`);
		await queryRunner.query(`DROP TABLE "discussion_threads"`);
		await queryRunner.query(`DROP TABLE "quiz_options"`);
		await queryRunner.query(
			`DROP INDEX "public"."uq_submission_answers_question"`,
		);
		await queryRunner.query(`DROP TABLE "submission_answers"`);
		await queryRunner.query(
			`DROP INDEX "public"."uq_quiz_questions_quiz_order"`,
		);
		await queryRunner.query(`DROP TABLE "quiz_questions"`);
		await queryRunner.query(`DROP INDEX "public"."uq_submissions_attempt"`);
		await queryRunner.query(`DROP TABLE "submissions"`);
		await queryRunner.query(
			`DROP INDEX "public"."idx_interventions_course_status"`,
		);
		await queryRunner.query(`DROP TABLE "interventions"`);
		await queryRunner.query(`DROP TABLE "risk_predictions"`);
		await queryRunner.query(`DROP INDEX "public"."idx_ai_jobs_status_queued"`);
		await queryRunner.query(`DROP INDEX "public"."idx_ai_jobs_type_status"`);
		await queryRunner.query(`DROP TABLE "ai_jobs"`);
		await queryRunner.query(
			`DROP INDEX "public"."uq_model_versions_name_version"`,
		);
		await queryRunner.query(`DROP TABLE "model_versions"`);
		await queryRunner.query(`DROP TABLE "learning_events"`);
		await queryRunner.query(`DROP TABLE "quizzes"`);
		await queryRunner.query(`DROP TABLE "lesson_materials"`);
		await queryRunner.query(
			`DROP INDEX "public"."uq_lesson_progress_enrollment_lesson"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_lesson_progress_user_status"`,
		);
		await queryRunner.query(
			`DROP INDEX "public"."idx_lesson_progress_course_completed"`,
		);
		await queryRunner.query(`DROP TABLE "lesson_progress"`);
		await queryRunner.query(`DROP INDEX "public"."uq_lessons_course_slug"`);
		await queryRunner.query(`DROP TABLE "lessons"`);
		await queryRunner.query(
			`DROP INDEX "public"."uq_course_sections_course_order"`,
		);
		await queryRunner.query(`DROP TABLE "course_sections"`);
		await queryRunner.query(`DROP INDEX "public"."uq_enrollments_user_course"`);
		await queryRunner.query(
			`DROP INDEX "public"."idx_enrollments_course_status"`,
		);
		await queryRunner.query(`DROP INDEX "public"."idx_enrollments_cohort"`);
		await queryRunner.query(`DROP TABLE "enrollments"`);
		await queryRunner.query(`DROP INDEX "public"."uq_courses_code"`);
		await queryRunner.query(`DROP INDEX "public"."uq_courses_slug"`);
		await queryRunner.query(
			`DROP INDEX "public"."idx_courses_category_status"`,
		);
		await queryRunner.query(`DROP INDEX "public"."idx_courses_owner"`);
		await queryRunner.query(`DROP TABLE "courses"`);
		await queryRunner.query(`DROP INDEX "public"."uq_categories_slug"`);
		await queryRunner.query(
			`DROP INDEX "public"."idx_categories_parent_order"`,
		);
		await queryRunner.query(`DROP TABLE "categories"`);
		await queryRunner.query(`DROP TABLE "notifications"`);
		await queryRunner.query(`DROP INDEX "public"."idx_users_role_status"`);
		await queryRunner.query(`DROP INDEX "public"."uq_users_student_code"`);
		await queryRunner.query(`DROP TABLE "users"`);
	}
}
