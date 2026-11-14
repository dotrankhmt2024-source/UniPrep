import { useMemo, useState } from 'react';
import { Empty, Input, Popover, Progress, Spin } from 'antd';
import { Link } from 'react-router';
import { Icon } from '@/components';

/** Một môn trong bộ chọn — với học viên là môn đang đăng ký (giống trang Khoá học của tôi). */
export interface SwitcherCourse {
	id: string;
	code: string;
	title: string;
	/** `null` với giảng viên/admin (không có tiến độ). */
	progressPercent: number | null;
	completedLessons?: number;
	totalLessons?: number;
}

export interface CourseSwitcherProps {
	courses: SwitcherCourse[];
	value: string | null;
	loading?: boolean;
	disabled?: boolean;
	/** Học viên: hiện tiến độ và lối tắt đăng ký thêm môn. */
	isStudent: boolean;
	onChange: (courseId: string) => void;
}

/** Màu ô viết tắt suy từ mã môn — cùng một môn luôn cùng màu. */
const AVATAR_TONES = [
	'bg-primary-container text-on-primary-container',
	'bg-secondary-container text-on-secondary-container',
	'bg-tertiary-container text-on-tertiary-container',
	'bg-surface-container-highest text-on-surface',
];

const toneOf = (code: string) => {
	let hash = 0;
	for (const char of code) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
	return AVATAR_TONES[hash % AVATAR_TONES.length];
};

/** `CO1023` → `CO`, `MATH101` → `MA`. */
const initialsOf = (code: string) =>
	(code.match(/[A-Za-z]/g) ?? ['?']).slice(0, 2).join('').toUpperCase();

const CourseAvatar = ({ code, size = 36 }: { code: string; size?: number }) => (
	<span
		className={`inline-flex shrink-0 items-center justify-center rounded-lg font-label-md font-bold ${toneOf(code)}`}
		style={{ width: size, height: size }}
		aria-hidden
	>
		{initialsOf(code)}
	</span>
);

const progressText = (course: SwitcherCourse) =>
	course.progressPercent === null
		? course.code
		: course.totalLessons
			? `${course.code} · ${course.completedLessons ?? 0}/${course.totalLessons} bài · ${Math.round(course.progressPercent)}%`
			: `${course.code} · ${Math.round(course.progressPercent)}%`;

/**
 * Bộ chọn môn kiểu "workspace switcher": nút hiện môn đang chọn (ô viết tắt + tên + tiến độ), bấm
 * mở danh sách môn để chuyển. Trợ giảng AI chỉ tra học liệu của môn đang chọn, nên đây chính là
 * "ngữ cảnh" của cuộc trò chuyện.
 */
export const CourseSwitcher = ({
	courses,
	value,
	loading = false,
	disabled = false,
	isStudent,
	onChange,
}: CourseSwitcherProps) => {
	const [open, setOpen] = useState(false);
	const [keyword, setKeyword] = useState('');
	const current = courses.find((course) => course.id === value) ?? null;

	const filtered = useMemo(() => {
		const query = keyword.trim().toLowerCase();
		if (!query) return courses;
		return courses.filter(
			(course) =>
				course.code.toLowerCase().includes(query) ||
				course.title.toLowerCase().includes(query),
		);
	}, [courses, keyword]);

	const content = (
		<div className="w-[340px] max-w-[calc(100vw-32px)]">
			<div className="px-1 pb-2 font-label-sm uppercase tracking-wide text-on-surface-variant">
				{isStudent ? 'Môn học bạn đang đăng ký' : 'Khoá học'}
			</div>
			{courses.length > 6 && (
				<Input
					allowClear
					autoFocus
					size="small"
					className="mb-2"
					placeholder="Tìm môn…"
					prefix={<Icon name="search" size={16} className="text-outline" />}
					value={keyword}
					onChange={(event) => setKeyword(event.target.value)}
				/>
			)}
			{loading ? (
				<div className="flex justify-center py-6">
					<Spin />
				</div>
			) : filtered.length === 0 ? (
				<Empty
					image={Empty.PRESENTED_IMAGE_SIMPLE}
					description={
						courses.length === 0 && isStudent
							? 'Bạn chưa đăng ký môn học nào'
							: 'Không có môn phù hợp'
					}
				/>
			) : (
				<ul className="max-h-[360px] space-y-1 overflow-y-auto" role="listbox">
					{filtered.map((course) => {
						const active = course.id === value;
						return (
							<li key={course.id}>
								<button
									type="button"
									role="option"
									aria-selected={active}
									className={`flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-container ${
										active ? 'bg-surface-container-high' : ''
									}`}
									onClick={() => {
										setOpen(false);
										setKeyword('');
										if (!active) onChange(course.id);
									}}
								>
									<CourseAvatar code={course.code} />
									<span className="min-w-0 flex-1">
										<span className="block truncate font-label-lg text-on-surface">
											{course.title}
										</span>
										<span className="block truncate font-body-sm text-on-surface-variant">
											{progressText(course)}
										</span>
										{course.progressPercent !== null && (
											<Progress
												percent={Math.round(course.progressPercent)}
												showInfo={false}
												size="small"
												className="!m-0"
											/>
										)}
									</span>
									{active && (
										<Icon name="check" size={18} className="text-primary" />
									)}
								</button>
							</li>
						);
					})}
				</ul>
			)}
			{isStudent && (
				<div className="mt-2 flex justify-between border-t border-outline-variant px-1 pt-2 font-label-md">
					<Link
						to="/my-courses"
						className="text-secondary hover:underline"
						onClick={() => setOpen(false)}
					>
						Khoá học của tôi
					</Link>
					<Link
						to="/"
						className="text-secondary hover:underline"
						onClick={() => setOpen(false)}
					>
						+ Đăng ký thêm môn
					</Link>
				</div>
			)}
		</div>
	);

	return (
		<Popover
			trigger="click"
			placement="bottomLeft"
			arrow={false}
			open={open && !disabled}
			onOpenChange={setOpen}
			content={content}
		>
			<button
				type="button"
				disabled={disabled}
				aria-haspopup="listbox"
				aria-expanded={open}
				className="flex min-w-[260px] max-w-[360px] items-center gap-3 rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-left shadow-sm transition-colors hover:bg-surface-container disabled:cursor-not-allowed disabled:opacity-60"
			>
				{current ? (
					<>
						<CourseAvatar code={current.code} />
						<span className="min-w-0 flex-1">
							<span className="block truncate font-label-lg text-on-surface">
								{current.title}
							</span>
							<span className="block truncate font-body-sm text-on-surface-variant">
								{progressText(current)}
							</span>
						</span>
					</>
				) : (
					<span className="flex-1 font-body-md text-on-surface-variant">
						{loading
							? 'Đang tải môn học…'
							: courses.length === 0 && isStudent
								? 'Chưa đăng ký môn nào'
								: 'Chọn môn học'}
					</span>
				)}
				<Icon name="unfold_more" size={18} className="text-outline" />
			</button>
		</Popover>
	);
};
