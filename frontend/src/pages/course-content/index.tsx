import { useEffect, useMemo, useState } from 'react';
import { Collapse, Empty, type CollapseProps } from 'antd';
import { Link, useParams } from 'react-router';
import { getMockCourseById } from '@/mocks/course';
import { COURSE_STATUS_LABEL, type CourseModuleType } from '@/types';
import { Badge, ErrorBadge, Icon, IOutLinedBtn } from '@/components';

const MODULE_ICON: Record<CourseModuleType, string> = {
	video: 'smart_display',
	file: 'description',
	quiz: 'quiz',
	forum: 'forum',
	assign: 'assignment',
	url: 'link',
};

const MODULE_TYPE_LABEL: Record<CourseModuleType, string> = {
	video: 'Video',
	file: 'Tài nguyên',
	quiz: 'Đề thi',
	forum: 'Diễn đàn',
	assign: 'Bài tập',
	url: 'Liên kết',
};

/** Trang nội dung khoá học — dựng theo design/Course_content.html nhưng rút gọn tối đa. */
const CourseContentPage = () => {
	const { courseId = '' } = useParams<{ courseId: string }>();
	const course = useMemo(() => getMockCourseById(courseId), [courseId]);

	const [activeKeys, setActiveKeys] = useState<string[]>(() =>
		(course?.sections ?? []).filter((section) => section.highlighted).map((section) => section.id),
	);

	// Mở sẵn các section được nhấn mạnh mỗi khi đổi sang khoá học khác.
	useEffect(() => {
		setActiveKeys((course?.sections ?? []).filter((section) => section.highlighted).map((section) => section.id));
	}, [course]);

	if (!course) {
		return (
			<div className="space-y-space-lg p-gutter">
				<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
					Không tìm thấy khoá học &quot;{courseId}&quot;.
				</ErrorBadge>
				<Link to="/" className="text-secondary hover:underline">
					← Quay lại danh sách khoá học
				</Link>
			</div>
		);
	}

	const allModules = course.sections.flatMap((section) => section.modules);
	const countByType = (type: CourseModuleType) => allModules.filter((module) => module.type === type).length;

	const blocks = [
		{ key: 'assign', label: 'Hoạt động', icon: 'assignment', count: countByType('assign') },
		{ key: 'quiz', label: 'Các đề thi', icon: 'quiz', count: countByType('quiz') },
		{ key: 'forum', label: 'Nhận xét', icon: 'forum', count: countByType('forum') },
		{
			key: 'resource',
			label: 'Tài nguyên',
			icon: 'description',
			count: countByType('file') + countByType('video') + countByType('url'),
		},
	];

	const collapseItems: CollapseProps['items'] = course.sections.map((section) => ({
		key: section.id,
		label: (
			<div className="flex flex-wrap items-center gap-2">
				<span className="font-title-md font-title-md font-semibold text-on-surface">{section.name}</span>
				{section.highlighted && <Badge status="warning">Đã được nhấn mạnh</Badge>}
				<Badge status="neutral">{section.modules.length} hoạt động</Badge>
			</div>
		),
		children:
			section.modules.length === 0 ? (
				<Empty description="Chưa có nội dung" image={Empty.PRESENTED_IMAGE_SIMPLE} />
			) : (
				<ul className="space-y-2">
					{section.modules.map((module) => (
						<li
							key={module.id}
							className="flex items-center gap-3 rounded-lg border border-outline-variant/60 p-space-sm hover:bg-surface-container-low"
						>
							<Icon name={MODULE_ICON[module.type]} size={20} className="text-secondary" />
							<div className="min-w-0 flex-1">
								<p className="font-body-md font-body-md text-on-surface">{module.name}</p>
								{module.meta && (
									<p className="font-label-sm font-label-sm text-on-surface-variant">{module.meta}</p>
								)}
							</div>
							<Badge status="neutral">{MODULE_TYPE_LABEL[module.type]}</Badge>
						</li>
					))}
				</ul>
			),
	}));

	return (
		<div className="space-y-space-lg p-gutter">
			<Link to="/" className="inline-flex items-center gap-1 font-label-md font-label-md text-secondary hover:underline">
				<Icon name="arrow_back" size={16} />
				Các khoá học của tôi
			</Link>

			<div className="flex flex-col gap-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<Badge status="info" size="md">
							{course.code}
						</Badge>
						<Badge status={course.status === 'in-progress' ? 'success' : 'neutral'} dot>
							{COURSE_STATUS_LABEL[course.status]}
						</Badge>
						<Badge status="neutral">Học kỳ {course.semester}</Badge>
					</div>
					<h1 className="font-headline-lg font-headline-lg text-on-surface">
						{course.name} — {course.group} {course.classes}
					</h1>
					<div className="flex flex-wrap items-center gap-x-space-md gap-y-1 font-body-sm font-body-sm text-on-surface-variant">
						<span className="inline-flex items-center gap-1">
							<Icon name="person" size={16} /> {course.teacher}
						</span>
						<span className="inline-flex items-center gap-1">
							<Icon name="school" size={16} /> {course.category}
						</span>
					</div>
				</div>

				<div className="flex shrink-0 gap-space-sm">
					<IOutLinedBtn
						icon={<Icon name="unfold_more" size={16} />}
						onClick={() => setActiveKeys(course.sections.map((section) => section.id))}
					>
						Mở rộng tất cả
					</IOutLinedBtn>
					<IOutLinedBtn icon={<Icon name="unfold_less" size={16} />} onClick={() => setActiveKeys([])}>
						Thu gọn toàn bộ
					</IOutLinedBtn>
				</div>
			</div>

			<div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
				<div className="lg:col-span-8">
					{course.sections.length === 0 ? (
						<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
							<Empty description="Khoá học chưa có nội dung" image={Empty.PRESENTED_IMAGE_SIMPLE} />
						</div>
					) : (
						<Collapse
							items={collapseItems}
							activeKey={activeKeys}
							onChange={(keys) => setActiveKeys(keys as string[])}
							expandIconPosition="end"
						/>
					)}
				</div>

				<aside className="lg:col-span-4">
					<div className="space-y-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
						<h2 className="font-title-md font-title-md font-semibold text-on-surface">Các khối</h2>
						<ul className="space-y-2">
							{blocks.map((block) => (
								<li key={block.key} className="flex items-center justify-between rounded-lg bg-surface-container-low p-space-sm">
									<span className="inline-flex items-center gap-2 font-body-sm font-body-sm text-on-surface">
										<Icon name={block.icon} size={18} className="text-secondary" />
										{block.label}
									</span>
									<Badge status="info">{block.count}</Badge>
								</li>
							))}
						</ul>
					</div>
				</aside>
			</div>
		</div>
	);
};

export default CourseContentPage;
