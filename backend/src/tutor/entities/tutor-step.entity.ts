import { Check, Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { TutorSession } from './tutor-session.entity';

/**
 * Vai trò của một bước trong trajectory.
 *
 * - `system`, `context`, `user`, `assistant`, `tool`: được gửi lại cho model ở các lượt sau
 *   (`context` được ghép vào tin nhắn `user` ngay sau nó).
 * - `answer`: câu trả lời cuối đã kiểm chứng để giao diện hiển thị, không gửi lại cho model.
 * - `error`: lỗi khi gọi model/tool, không gửi lại cho model.
 */
export const TUTOR_STEP_ROLES = [
	'system',
	'context',
	'user',
	'assistant',
	'tool',
	'answer',
	'error',
] as const;
export type TutorStepRole = (typeof TUTOR_STEP_ROLES)[number];

export interface StoredToolCall {
	id: string;
	name: string;
	arguments: string;
}

/**
 * Bảng `tutor_steps` — từng bước của agent (port từ `advisor_steps` của DACN2): tin nhắn, lời gọi
 * tool, kết quả tool, suy luận của model, token và thời gian. Lưu đủ để dựng lại hội thoại gửi model
 * ở lượt sau và để giao diện hiện trajectory.
 */
@Entity('tutor_steps')
@Index('uq_tutor_steps_session_seq', ['sessionId', 'seq'], { unique: true })
@Check(
	'chk_tutor_steps_role',
	`"role" IN ('system', 'context', 'user', 'assistant', 'tool', 'answer', 'error')`,
)
export class TutorStep extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'session_id' })
	sessionId: string;

	@ManyToOne(() => TutorSession, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'session_id' })
	session: TutorSession;

	/** Lượt hỏi-đáp, bắt đầu từ 1. */
	@Column({ type: 'integer', name: 'turn' })
	turn: number;

	/** Thứ tự tuyệt đối trong cuộc trò chuyện. */
	@Column({ type: 'integer', name: 'seq' })
	seq: number;

	@Column({ type: 'varchar', name: 'role', length: 20 })
	role: TutorStepRole;

	/** Nội dung đúng như đã gửi/nhận với model (tool: chuỗi JSON kết quả). */
	@Column({ type: 'text', name: 'content', nullable: true })
	content: string | null;

	/** Chuỗi suy luận (`reasoning_content`) của model ở chế độ thinking. */
	@Column({ type: 'text', name: 'reasoning', nullable: true })
	reasoning: string | null;

	@Column({ type: 'jsonb', name: 'tool_calls', nullable: true })
	toolCalls: StoredToolCall[] | null;

	@Column({
		type: 'varchar',
		name: 'tool_call_id',
		length: 100,
		nullable: true,
	})
	toolCallId: string | null;

	@Column({ type: 'varchar', name: 'tool_name', length: 100, nullable: true })
	toolName: string | null;

	@Column({ type: 'jsonb', name: 'tool_args', nullable: true })
	toolArgs: unknown;

	/** Dữ liệu có cấu trúc cho giao diện: kết quả tool, câu trả lời cuối, thông tin context. */
	@Column({ type: 'jsonb', name: 'data', nullable: true })
	data: unknown;

	@Column({ type: 'integer', name: 'prompt_tokens', nullable: true })
	promptTokens: number | null;

	@Column({ type: 'integer', name: 'completion_tokens', nullable: true })
	completionTokens: number | null;

	@Column({ type: 'integer', name: 'cache_hit_tokens', nullable: true })
	cacheHitTokens: number | null;

	@Column({ type: 'integer', name: 'duration_ms', nullable: true })
	durationMs: number | null;
}
