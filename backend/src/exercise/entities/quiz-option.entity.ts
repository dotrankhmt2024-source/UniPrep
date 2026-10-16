import { Column, Entity, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { QuizQuestion } from './quiz-question.entity';

/**
 * Phương án lựa chọn của một câu hỏi trắc nghiệm.
 * Xem `docs/02-specs/database-design.md` §3.3.5.
 */
@Entity('quiz_options')
export class QuizOption extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'question_id' })
	questionId: string;

	// CASCADE: phương án thuộc câu hỏi; câu hỏi bị xoá thì phương án vô nghĩa (§4.2).
	@ManyToOne(() => QuizQuestion, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'question_id' })
	question: QuizQuestion;

	@Column({ type: 'text', name: 'content' })
	content: string;

	// `select: false` là bắt buộc về bảo mật: đáp án đúng không được trả cho học
	// viên khi đang làm bài; chỉ lấy bằng `addSelect()` tường minh (§6, §8.7).
	@Column({
		type: 'boolean',
		name: 'is_correct',
		default: false,
		select: false,
	})
	isCorrect: boolean;

	@Column({ type: 'integer', name: 'order_index', default: 0 })
	orderIndex: number;
}
