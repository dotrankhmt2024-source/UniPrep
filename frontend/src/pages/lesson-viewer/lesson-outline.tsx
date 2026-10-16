import { Collapse, type CollapseProps } from 'antd';
import { Badge, Icon } from '@/components';
import {
	getDerivedTypeLabel,
	type LessonOutlineItem,
} from './lesson-viewer.helpers';

/**
 * Cột trái của trang xem bài học (E3-T8): mục lục chương → bài, dựng bằng `Collapse` của antd.
 *
 * Mỗi bài là một `<button>` chứ không phải `<li>` tĩnh: chọn bài là hành động chính của trang, và
 * `<button>` cho sẵn điều hướng bàn phím. Điều hướng thật do `onSelect` gọi `navigate` ở trang cha.
 */

interface LessonOutlineProps {
	outline: LessonOutlineItem[];
	activeLessonId: string | null;
	/** Các chương đang mở; trang cha giữ state để mở sẵn chương chứa bài đang xem. */
	openSectionIds: string[];
	onOpenSectionChange: (keys: string[]) => void;
	onSelectLesson: (lessonId: string) => void;
}

const LessonOutline = ({
	outline,
	activeLessonId,
	openSectionIds,
	onOpenSectionChange,
	onSelectLesson,
}: LessonOutlineProps) => {
	const items: CollapseProps['items'] = outline.map((panel) => ({
		key: panel.key,
		label: (
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				<span className="min-w-0 font-title-md font-title-md font-semibold text-on-surface">
					{panel.title}
				</span>
				<Badge status="neutral">{panel.lessons.length} bài</Badge>
			</div>
		),
		children:
			panel.lessons.length === 0 ? (
				<p className="font-body-sm font-body-sm text-on-surface-variant">
					Chương này chưa có bài học nào được công bố.
				</p>
			) : (
				<ul className="space-y-2">
					{panel.lessons.map((lesson) => {
						const isActive = lesson.id === activeLessonId;

						return (
							<li key={lesson.id}>
								<button
									type="button"
									onClick={() => onSelectLesson(lesson.id)}
									aria-current={isActive ? 'true' : undefined}
									className={[
										'flex w-full items-center gap-3 rounded-lg border p-space-sm text-left transition-colors',
										isActive
											? 'border-secondary bg-secondary/10'
											: 'border-outline-variant/60 hover:bg-surface-container-low',
									].join(' ')}
								>
									<Icon
										name={isActive ? 'play_circle' : 'menu_book'}
										size={20}
										className={
											isActive
												? 'shrink-0 text-secondary'
												: 'shrink-0 text-outline'
										}
									/>
									<span className="min-w-0 flex-1 space-y-1">
										<span
											className={[
												'block font-body-md font-body-md',
												isActive
													? 'font-semibold text-secondary'
													: 'text-on-surface',
											].join(' ')}
										>
											{lesson.title}
										</span>
										<span className="flex flex-wrap items-center gap-2">
											<Badge status={isActive ? 'info' : 'neutral'}>
												{getDerivedTypeLabel(lesson)}
											</Badge>
											{lesson.estimatedMinutes !== null && (
												<span className="font-label-sm font-label-sm text-on-surface-variant">
													{lesson.estimatedMinutes} phút
												</span>
											)}
										</span>
									</span>
								</button>
							</li>
						);
					})}
				</ul>
			),
	}));

	return (
		<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
			<div className="mb-space-sm flex flex-wrap items-center gap-space-sm">
				<h2 className="font-title-lg font-title-lg text-on-surface">
					Nội dung khoá học
				</h2>
				<Badge status="neutral">
					{outline.reduce((total, panel) => total + panel.lessons.length, 0)}{' '}
					bài
				</Badge>
			</div>

			<Collapse
				items={items}
				activeKey={openSectionIds}
				onChange={(keys) => onOpenSectionChange(keys as string[])}
				expandIconPosition="end"
			/>
		</div>
	);
};

export default LessonOutline;
