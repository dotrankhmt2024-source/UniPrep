import { Collapse, Empty, Skeleton, type CollapseProps } from 'antd';
import { Link } from 'react-router';
import { Badge, ErrorBadge, Icon } from '@/components';
import {
	LESSON_DERIVED_TYPE_LABEL,
	type LessonDerivedType,
	type LessonListItem,
	type SectionListItem,
} from '@/types';

/**
 * Mục lục khoá học (E3-T7) — cây "chương → bài học" dạng `Collapse`.
 *
 * Vì sao tách khỏi `index.tsx`: đây là khối lớn nhất của trang và có bốn trạng thái riêng
 * (đang tải / lỗi / rỗng / có dữ liệu) hoàn toàn độc lập với phần thân khoá học — trang chi tiết
 * vẫn dùng được khi mục lục lỗi.
 *
 * `getLessons` bị chặn trần `take = 100` ở backend, nên khi khoá có nhiều hơn 100 bài học thì
 * `lessons` ngắn hơn `lessonTotal`; component nói rõ điều đó thay vì im lặng hiển thị thiếu.
 */

/** Biểu tượng Material Symbols cho `derivedType` — chỉ để nhìn, không ghi ngược xuống server. */
const LESSON_DERIVED_TYPE_ICON: Record<LessonDerivedType, string> = {
	text: 'article',
	video: 'smart_display',
	slide: 'slideshow',
	file: 'description',
};

interface CourseSyllabusProps {
	courseId: string;
	sections: SectionListItem[];
	lessons: LessonListItem[];
	/** Tổng số bài học theo `meta.itemCount`; có thể lớn hơn `lessons.length`. */
	lessonTotal: number;
	isLoading: boolean;
	error: string;
	/** Các chương đang mở — điều khiển từ trang để dùng chung với nút "Mở rộng tất cả". */
	activeKeys: string[];
	onActiveKeysChange: (keys: string[]) => void;
}

const CourseSyllabus = ({
	courseId,
	sections,
	lessons,
	lessonTotal,
	isLoading,
	error,
	activeKeys,
	onActiveKeysChange,
}: CourseSyllabusProps) => {
	const collapseItems: CollapseProps['items'] = sections.map((section) => {
		const sectionLessons = lessons.filter(
			(lesson) => lesson.sectionId === section.id,
		);

		return {
			key: section.id,
			label: (
				<div className="flex flex-wrap items-center gap-2">
					<span className="font-title-md font-title-md font-semibold text-on-surface">
						{section.title}
					</span>
					<Badge status="neutral">{section.lessonCount} bài học</Badge>
					{/* Chương chưa công bố chỉ giảng viên/admin nhìn thấy (học viên bị chặn cả trang). */}
					{!section.isPublished && <Badge status="warning">Chưa công bố</Badge>}
				</div>
			),
			children:
				sectionLessons.length === 0 ? (
					<Empty
						description="Chương chưa có bài học"
						image={Empty.PRESENTED_IMAGE_SIMPLE}
					/>
				) : (
					<ul className="space-y-2">
						{sectionLessons.map((lesson) => (
							<li
								key={lesson.id}
								className="flex flex-wrap items-center gap-3 rounded-lg border border-outline-variant/60 p-space-sm hover:bg-surface-container-low"
							>
								<Icon
									name={LESSON_DERIVED_TYPE_ICON[lesson.derivedType]}
									size={20}
									className="text-secondary"
								/>
								<div className="min-w-0 flex-1">
									<Link
										to={`/courses/${courseId}/learn/${lesson.id}`}
										className="font-body-md font-body-md text-on-surface hover:text-secondary hover:underline"
									>
										{lesson.title}
									</Link>
									{lesson.summary && (
										<p className="font-label-sm font-label-sm text-on-surface-variant">
											{lesson.summary}
										</p>
									)}
								</div>
								{lesson.estimatedMinutes !== null && (
									<span className="font-label-sm font-label-sm text-on-surface-variant">
										{lesson.estimatedMinutes} phút
									</span>
								)}
								<Badge status="info">
									{LESSON_DERIVED_TYPE_LABEL[lesson.derivedType]}
								</Badge>
								{/* Bài chưa công bố: chỉ giảng viên/admin thấy, học viên không nhận được dòng này. */}
								{!lesson.isPublished && (
									<Badge status="warning">Chưa công bố</Badge>
								)}
							</li>
						))}
					</ul>
				),
		};
	});

	const renderBody = () => {
		if (error) {
			return (
				<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
					{error}
				</ErrorBadge>
			);
		}

		if (isLoading) return <Skeleton active paragraph={{ rows: 4 }} />;

		if (collapseItems.length === 0) {
			return (
				<Empty
					description="Khoá học chưa có nội dung"
					image={Empty.PRESENTED_IMAGE_SIMPLE}
				/>
			);
		}

		return (
			<Collapse
				items={collapseItems}
				activeKey={activeKeys}
				onChange={(keys) => onActiveKeysChange(keys as string[])}
				expandIconPosition="end"
			/>
		);
	};

	return (
		<section className="space-y-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
			<div className="flex flex-wrap items-baseline justify-between gap-space-sm">
				<h2 className="font-title-lg font-title-lg text-on-surface">
					Mục lục khoá học
				</h2>
				{lessonTotal > lessons.length && (
					<span className="font-label-sm font-label-sm text-on-surface-variant">
						Đang hiển thị {lessons.length}/{lessonTotal} bài học đầu tiên
					</span>
				)}
			</div>

			{renderBody()}
		</section>
	);
};

export default CourseSyllabus;
