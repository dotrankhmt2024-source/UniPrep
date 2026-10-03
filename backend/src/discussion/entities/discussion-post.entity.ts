import { Column, Entity, Index, JoinColumn, ManyToOne } from 'typeorm';
import { BaseEntityCustom } from '../../common/entities/base-custom.entity';
import { User } from '../../user/entities/user.entity';
import { DiscussionThread } from './discussion-thread.entity';

/**
 * Bài viết trong một chủ đề thảo luận, hỗ trợ trả lời lồng nhau một cấp qua
 * `parent_post_id`. Xem `docs/02-specs/database-design.md` §3.3.9.
 */
@Entity('discussion_posts')
@Index('idx_discussion_posts_thread_time', ['threadId', 'createdAt'])
export class DiscussionPost extends BaseEntityCustom {
	@Column({ type: 'uuid', name: 'thread_id' })
	threadId: string;

	// CASCADE: bài viết thuộc chủ đề (§4.2).
	@ManyToOne(() => DiscussionThread, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'thread_id' })
	thread: DiscussionThread;

	// CASCADE: nội dung do người dùng tạo là dữ liệu cá nhân của họ (§4.2).
	//
	// Index thật phải tạo thủ công (có `DESC` nên TypeORM không sinh được qua
	// `@Index`); placeholder dưới đây chỉ để tài liệu hoá tên index:
	//   CREATE INDEX idx_discussion_posts_author_time ON discussion_posts (author_id, created_at DESC);
	@Index('idx_discussion_posts_author_time', { synchronize: false })
	@Column({ type: 'uuid', name: 'author_id' })
	authorId: string;

	@ManyToOne(() => User, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'author_id' })
	author: User;

	@Column({ type: 'uuid', name: 'parent_post_id', nullable: true })
	parentPostId: string | null;

	// Self-FK CASCADE: xoá bài cha kéo theo các trả lời của nó (§4.2).
	@ManyToOne(() => DiscussionPost, { nullable: true, onDelete: 'CASCADE' })
	@JoinColumn({ name: 'parent_post_id' })
	parentPost: DiscussionPost | null;

	@Column({ type: 'text', name: 'body' })
	body: string;

	@Column({ type: 'boolean', name: 'is_hidden', default: false })
	isHidden: boolean;

	@Column({ type: 'uuid', name: 'hidden_by', nullable: true })
	hiddenBy: string | null;

	// SET NULL: dữ liệu tham chiếu — quyết định kiểm duyệt sống độc lập với người
	// kiểm duyệt (§4.2).
	@ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
	@JoinColumn({ name: 'hidden_by' })
	moderator: User | null;

	@Column({
		type: 'varchar',
		name: 'hidden_reason',
		length: 255,
		nullable: true,
	})
	hiddenReason: string | null;

	// Soft delete để giữ mạch thảo luận; §11 câu hỏi mở 5 còn cân nhắc thêm cột
	// ẩn danh hoá nội dung ("[đã xoá]") — chưa chốt nên chưa thêm cột.
	@Column({ type: 'timestamptz', name: 'deleted_at', nullable: true })
	deletedAt: Date | null;
}
