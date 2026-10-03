import { useCallback, useEffect, useState } from 'react';
import { Skeleton, message } from 'antd';
import { Link, useNavigate, useParams } from 'react-router';
import { getCourseById } from '@/apis/course';
import { enrollCourse } from '@/apis/enrollment';
import { getLessons, getSections } from '@/apis/lesson';
import { Badge, ErrorBadge, Icon, IOutLinedBtn } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import { useAppSelector } from '@/store/hooks';
import {
	COURSE_LEVEL_LABEL,
	COURSE_PUBLISH_STATUS_LABEL,
	type CourseDetail,
	type LessonListItem,
	type SectionListItem,
} from '@/types';
import {
	COURSE_LEVEL_TONE,
	formatEstimatedHours,
	getCourseStatusBadgeTone,
} from '@/utils/course';
import CourseEnrollmentPanel from './enrollment-panel';
import CourseSyllabus from './syllabus';

/**
 * Trang chi tiết khoá học (E3-T7) — route `/courses/:courseId`, mọi vai trò đã đăng nhập.
 *
 * Khác trang `course-content` (thời mock): trang này đọc API thật và có **nút đăng ký thật**.
 *
 * Ba quyết định đáng lưu ý:
 * 1. Chi tiết khoá học và mục lục là **hai request độc lập**: backend không trả `sections` trong
 *    `GET /api/courses/:id` (xem `apis/course`), và mục lục lỗi thì phần thân khoá học vẫn phải
 *    xem được.
 * 2. `403` của `GET /api/courses/:id` không phải "bạn không có quyền" chung chung mà là **khoá học
 *    chưa công bố** (backend dùng 403 thay vì 404 để FE phân biệt được với "gõ sai ID"); hai mã
 *    này phải hiện hai thông báo khác nhau.
 * 3. `description` là cột TEXT (đề cương), không phải nội dung TipTap của bài học ⇒ render nguyên
 *    văn với `whitespace-pre-wrap`, KHÔNG `dangerouslySetInnerHTML`.
 */

interface PageError {
	/** `null` khi lỗi không đến từ HTTP (mất kết nối, `data = null`…). */
	status: number | null;
	message: string;
}

/** Đọc mã HTTP từ lỗi axios — cùng cách `utils/auth.isEmailTakenError` đang làm. */
const getErrorStatus = (error: unknown): number | null =>
	(error as { response?: { status?: number } }).response?.status ?? null;

/**
 * Câu thông báo theo mã HTTP, nhưng vẫn ưu tiên câu tiếng Việt của backend (`getApiErrorMessage`)
 * vì đó là nguồn chân lý; `fallback` chỉ dùng khi backend không kèm message.
 */
const describeLoadError = (error: unknown, courseId: string): PageError => {
	const status = getErrorStatus(error);
	const fallback =
		status === 404
			? `Không tìm thấy khoá học "${courseId}".`
			: status === 403
				? 'Khoá học này chưa được công bố.'
				: 'Không tải được khoá học, vui lòng thử lại.';

	return { status, message: getApiErrorMessage(error, fallback) };
};

const CourseDetailPage = () => {
	const { courseId = '' } = useParams<{ courseId: string }>();
	const navigate = useNavigate();
	const role = useAppSelector((state) => state.auth.user?.role);
	const currentUserId = useAppSelector((state) => state.auth.user?.id);

	const [course, setCourse] = useState<CourseDetail | null>(null);
	const [sections, setSections] = useState<SectionListItem[]>([]);
	const [lessons, setLessons] = useState<LessonListItem[]>([]);
	const [lessonTotal, setLessonTotal] = useState(0);
	const [activeKeys, setActiveKeys] = useState<string[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [pageError, setPageError] = useState<PageError | null>(null);
	const [isLoadingSyllabus, setIsLoadingSyllabus] = useState(true);
	const [syllabusError, setSyllabusError] = useState('');
	const [isEnrolling, setIsEnrolling] = useState(false);
	const [reloadKey, setReloadKey] = useState(0);

	/** Nạp lại chi tiết + mục lục mà không đổi route — dùng sau mỗi lần ghi danh. */
	const reload = useCallback(() => setReloadKey((value) => value + 1), []);

	useEffect(() => {
		// Cờ `cancelled` chặn setState sau khi rời trang / đổi khoá học khi request còn bay.
		let cancelled = false;

		const load = async () => {
			if (!courseId) {
				setCourse(null);
				setPageError({ status: 404, message: 'Không tìm thấy khoá học.' });
				setIsLoading(false);
				return;
			}

			setIsLoading(true);
			setPageError(null);

			try {
				const response = await getCourseById(courseId);
				if (cancelled) return;

				if (!response.data) {
					setCourse(null);
					setPageError({
						status: null,
						message: 'Không tải được khoá học, vui lòng thử lại.',
					});
					return;
				}

				setCourse(response.data);
			} catch (error) {
				if (cancelled) return;

				setCourse(null);
				setPageError(describeLoadError(error, courseId));
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [courseId, reloadKey]);

	useEffect(() => {
		let cancelled = false;

		const load = async () => {
			if (!courseId) {
				setSections([]);
				setLessons([]);
				setLessonTotal(0);
				setIsLoadingSyllabus(false);
				return;
			}

			setIsLoadingSyllabus(true);
			setSyllabusError('');

			try {
				// `getSections` không truyền `take`: backend mặc định 100 cho endpoint này (trần
				// `MAX_TAKE`). Bài học thì phải truyền tường minh và sắp theo lộ trình.
				const [sectionsResponse, lessonsResponse] = await Promise.all([
					getSections(courseId),
					getLessons(courseId, {
						take: 100,
						sortBy: 'orderIndex',
						order: 'asc',
					}),
				]);

				if (cancelled) return;

				const lessonItems = lessonsResponse.data?.items ?? [];

				setSections(sectionsResponse.data?.items ?? []);
				setLessons(lessonItems);
				// `itemCount` là tổng thật của khoá; lớn hơn `lessonItems.length` khi khoá có hơn
				// 100 bài học — component mục lục nói rõ phần bị cắt thay vì im lặng.
				setLessonTotal(
					lessonsResponse.data?.meta.itemCount ?? lessonItems.length,
				);
			} catch (error) {
				if (cancelled) return;

				setSections([]);
				setLessons([]);
				setLessonTotal(0);
				setSyllabusError(
					getApiErrorMessage(error, 'Không tải được mục lục khoá học.'),
				);
			} finally {
				if (!cancelled) setIsLoadingSyllabus(false);
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [courseId, reloadKey]);

	// Đổi sang khoá học khác thì thu gọn mục lục; nạp lại sau khi ghi danh thì giữ nguyên
	// các chương người dùng đang mở.
	useEffect(() => {
		setActiveKeys([]);
	}, [courseId]);

	const handleEnroll = async () => {
		if (isEnrolling || !courseId) return;

		setIsEnrolling(true);

		try {
			const response = await enrollCourse({ courseId });
			message.success(response.message || 'Đăng ký khoá học thành công');
		} catch (error) {
			// 409 "Bạn đã đăng ký khoá học này." và 400 "khoá học đã đủ số lượng học viên." /
			// "Bạn cần hoàn thành khoá học tiên quyết trước…" / "Khoá học này không mở đăng ký."
			// đều là lỗi nghiệp vụ kèm câu tiếng Việt — phải hiện nguyên văn, không nuốt thành
			// một câu chung.
			message.error(
				getApiErrorMessage(
					error,
					'Đăng ký khoá học thất bại, vui lòng thử lại.',
				),
			);
		} finally {
			setIsEnrolling(false);
			// Nạp lại ở CẢ HAI nhánh: thành công thì thấy `myEnrollment` mới, thất bại thì thấy
			// trạng thái mới nhất (khoá vừa hết chỗ, hoặc đã ghi danh từ tab khác).
			reload();
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-space-lg p-gutter">
				<Skeleton active paragraph={{ rows: 3 }} />
				<Skeleton active paragraph={{ rows: 6 }} />
			</div>
		);
	}

	if (pageError || !course) {
		const errorTitle =
			pageError?.status === 404
				? 'Không tìm thấy khoá học'
				: pageError?.status === 403
					? 'Khoá học chưa được công bố'
					: 'Không tải được khoá học';

		return (
			<div className="space-y-space-lg p-gutter">
				<h1 className="font-headline-lg font-headline-lg text-on-surface">
					{errorTitle}
				</h1>
				<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
					{pageError?.message ?? 'Không tải được khoá học, vui lòng thử lại.'}
				</ErrorBadge>
				<Link to="/" className="text-secondary hover:underline">
					← Quay lại danh sách khoá học
				</Link>
			</div>
		);
	}

	/**
	 * `role !== 'student'` ⇒ không bao giờ hiện nút đăng ký (xem `enrollment-panel`). `canManage`
	 * chỉ để chọn lời giải thích: backend không trả cờ này, phải suy từ `owner` + `instructors`.
	 */
	const isStaff = role !== 'student';
	const canManage =
		role === 'admin' ||
		(!!currentUserId &&
			(course.owner.id === currentUserId ||
				course.instructors.some((item) => item.userId === currentUserId)));

	const summaryRows = [
		{
			key: 'sections',
			label: 'Chương học',
			icon: 'menu_book',
			value: `${course.sectionCount}`,
		},
		{
			key: 'lessons',
			label: 'Bài học',
			icon: 'article',
			value: `${course.lessonCount}`,
		},
		{
			key: 'learners',
			label: 'Học viên đã đăng ký',
			icon: 'group',
			value: `${course.enrolledCount}`,
		},
		{
			key: 'hours',
			label: 'Thời lượng dự kiến',
			icon: 'schedule',
			value: formatEstimatedHours(course.estimatedHours),
		},
	];

	return (
		<div className="space-y-space-lg p-gutter">
			<Link
				to="/"
				className="inline-flex items-center gap-1 font-label-md font-label-md text-secondary hover:underline"
			>
				<Icon name="arrow_back" size={16} />
				Quay lại danh sách khoá học
			</Link>

			<div className="flex flex-col gap-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm lg:flex-row lg:items-start lg:justify-between">
				<div className="space-y-2">
					<div className="flex flex-wrap items-center gap-2">
						<Badge status="info" size="md">
							{course.code}
						</Badge>
						{/* Nhãn trạng thái chỉ có nghĩa với người soạn nội dung: học viên chỉ bao giờ
						    nhận được khoá đã publish nên nhãn sẽ luôn là "Đã xuất bản". */}
						{isStaff && (
							<Badge status={getCourseStatusBadgeTone(course.status)} dot>
								{COURSE_PUBLISH_STATUS_LABEL[course.status]}
							</Badge>
						)}
						{course.semester && (
							<Badge status="neutral">Học kỳ {course.semester}</Badge>
						)}
						{course.level && (
							<Badge status={COURSE_LEVEL_TONE[course.level]}>
								{COURSE_LEVEL_LABEL[course.level]}
							</Badge>
						)}
					</div>

					<h1 className="font-headline-lg font-headline-lg text-on-surface">
						{course.title}
					</h1>

					<div className="flex flex-wrap items-center gap-x-space-md gap-y-1 font-body-sm font-body-sm text-on-surface-variant">
						<span className="inline-flex items-center gap-1">
							<Icon name="person" size={16} /> {course.owner.fullName}
						</span>
						{course.category && (
							<span className="inline-flex items-center gap-1">
								<Icon name="school" size={16} /> {course.category.name}
							</span>
						)}
						<span className="inline-flex items-center gap-1">
							<Icon name="schedule" size={16} />{' '}
							{formatEstimatedHours(course.estimatedHours)}
						</span>
						<span className="inline-flex items-center gap-1">
							<Icon name="menu_book" size={16} /> {course.sectionCount} chương •{' '}
							{course.lessonCount} bài học
						</span>
						<span className="inline-flex items-center gap-1">
							<Icon name="group" size={16} /> {course.enrolledCount} học viên
						</span>
					</div>

					{course.summary && (
						<p className="font-body-md font-body-md text-on-surface-variant">
							{course.summary}
						</p>
					)}
				</div>

				<div className="flex shrink-0 flex-wrap gap-space-sm">
					<IOutLinedBtn
						icon={<Icon name="unfold_more" size={16} />}
						disabled={sections.length === 0}
						onClick={() => setActiveKeys(sections.map((section) => section.id))}
					>
						Mở rộng tất cả
					</IOutLinedBtn>
					<IOutLinedBtn
						icon={<Icon name="unfold_less" size={16} />}
						disabled={sections.length === 0}
						onClick={() => setActiveKeys([])}
					>
						Thu gọn toàn bộ
					</IOutLinedBtn>
				</div>
			</div>

			<div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
				<div className="space-y-space-lg lg:col-span-8">
					<section className="space-y-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
						<h2 className="font-title-lg font-title-lg text-on-surface">
							Đề cương khoá học
						</h2>
						{course.description ? (
							/* Cột TEXT: giữ nguyên xuống dòng, KHÔNG render HTML (khác `lessons.content`). */
							<p className="whitespace-pre-wrap font-body-md font-body-md text-on-surface">
								{course.description}
							</p>
						) : (
							<p className="font-body-md font-body-md text-on-surface-variant">
								Chưa có đề cương.
							</p>
						)}
					</section>

					<CourseSyllabus
						courseId={courseId}
						sections={sections}
						lessons={lessons}
						lessonTotal={lessonTotal}
						isLoading={isLoadingSyllabus}
						error={syllabusError}
						activeKeys={activeKeys}
						onActiveKeysChange={setActiveKeys}
					/>

					{course.prerequisites.length > 0 && (
						<section className="space-y-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
							<div className="space-y-1">
								<h2 className="font-title-lg font-title-lg text-on-surface">
									Điều kiện tiên quyết
								</h2>
								<p className="font-body-sm font-body-sm text-on-surface-variant">
									Cần hoàn thành các khoá học sau trước khi đăng ký khoá học
									này.
								</p>
							</div>

							<ul className="space-y-2">
								{course.prerequisites.map((prerequisite) => (
									<li
										key={prerequisite.id}
										className="flex flex-wrap items-center justify-between gap-space-sm rounded-lg border border-outline-variant/60 p-space-sm hover:bg-surface-container-low"
									>
										<Link
											to={`/courses/${prerequisite.id}`}
											className="min-w-0 font-body-md font-body-md text-on-surface hover:text-secondary hover:underline"
										>
											<span className="font-label-sm font-label-sm text-on-surface-variant">
												{prerequisite.code}
											</span>{' '}
											{prerequisite.title}
										</Link>
										<Badge
											status={prerequisite.isSatisfied ? 'success' : 'warning'}
											dot
										>
											{prerequisite.isSatisfied
												? 'Đã hoàn thành'
												: 'Chưa hoàn thành'}
										</Badge>
									</li>
								))}
							</ul>
						</section>
					)}
				</div>

				<aside className="space-y-space-lg lg:col-span-4">
					<CourseEnrollmentPanel
						course={course}
						isStaff={isStaff}
						canManage={canManage}
						isEnrolling={isEnrolling}
						onEnroll={handleEnroll}
						onGoToLearn={() => navigate(`/courses/${courseId}/learn`)}
					/>

					<Link
						to={`/courses/${courseId}/quizzes`}
						className="flex items-center justify-between gap-space-sm border-y border-outline-variant py-space-md font-label-md text-secondary hover:underline"
					>
						<span className="inline-flex items-center gap-2">
							<Icon name="quiz" size={18} />
							Bài kiểm tra
						</span>
						<Icon name="arrow_forward" size={18} />
					</Link>

					<section className="space-y-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
						<h2 className="font-title-md font-title-md font-semibold text-on-surface">
							Nội dung khoá học
						</h2>
						<ul className="space-y-2">
							{summaryRows.map((row) => (
								<li
									key={row.key}
									className="flex items-center justify-between gap-space-sm rounded-lg bg-surface-container-low p-space-sm"
								>
									<span className="inline-flex items-center gap-2 font-body-sm font-body-sm text-on-surface">
										<Icon
											name={row.icon}
											size={18}
											className="text-secondary"
										/>
										{row.label}
									</span>
									<Badge status="info">{row.value}</Badge>
								</li>
							))}
						</ul>
					</section>
				</aside>
			</div>
		</div>
	);
};

export default CourseDetailPage;
