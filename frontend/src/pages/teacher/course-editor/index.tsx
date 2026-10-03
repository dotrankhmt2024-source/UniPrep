import { useCallback, useEffect, useRef, useState } from 'react';
import { Spin, Tabs, message } from 'antd';
import dayjs from 'dayjs';
import { Link, useParams } from 'react-router';
import { getCourseById, publishCourse, unpublishCourse } from '@/apis/course';
import { Badge, ErrorBadge, Icon, IOutLinedBtn, ISolidBtn } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import CourseContentEditor from '@/pages/teacher/content-editor';
import { COURSE_PUBLISH_STATUS_LABEL, type CourseDetail } from '@/types';
import { getCourseStatusBadgeTone } from '@/utils/course';
import CourseCohortsTab from './course-cohorts-tab';
import CourseInstructorsTab from './course-instructors-tab';
import CourseMetadataTab from './course-metadata-tab';
import CoursePrerequisitesTab from './course-prerequisites-tab';

/**
 * Trang soạn thảo một khoá học của khu giảng viên (E3-T9) — route `/teacher/courses/:courseId`.
 *
 * **Một nguồn chân lý cho phần "vỏ":** `getCourseById(courseId)` được gọi đúng một lần khi vào
 * trang (và mỗi lần một tab báo có thay đổi), kết quả giữ trong `course`. Header, form metadata và
 * tab điều kiện tiên quyết đều đọc từ đó, nên sau khi lưu không có hai bản dữ liệu lệch nhau.
 *
 * Tab **"Nội dung"** chỉ là `<CourseContentEditor courseId={courseId} />` — module đó do phần 2
 * của E3-T9 viết và tự nạp dữ liệu bài học của nó; trang này không truyền gì thêm.
 *
 * Bốn tab còn lại tự nạp dữ liệu riêng (giảng viên, lớp) hoặc nhận `course` từ trang cha
 * (metadata, tiên quyết) vì chúng dùng chung dữ liệu chi tiết.
 */
const TeacherCourseEditorPage = () => {
	const { courseId } = useParams<{ courseId: string }>();

	const [course, setCourse] = useState<CourseDetail | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	/** Nạp lại ngầm sau khi một tab ghi thành công — không được che mất các tab đang xem. */
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [loadError, setLoadError] = useState('');
	const [reloadKey, setReloadKey] = useState(0);
	const [isTogglingStatus, setIsTogglingStatus] = useState(false);
	/**
	 * Lần nạp đầu tiên được phép hiện `Spin` toàn trang; các lần nạp sau (do `reload()` sau khi
	 * lưu) phải giữ nguyên cây tab đang xem, nếu không `Tabs` sẽ remount và người dùng bị đẩy về
	 * tab "Thông tin khoá học" sau mỗi lần lưu.
	 */
	const hasLoadedOnce = useRef(false);

	/** Nạp lại chi tiết sau mỗi thao tác ghi của bất kỳ tab nào. */
	const reload = useCallback(() => setReloadKey((value) => value + 1), []);

	/** Trạng thái chỉ để vẽ nút ở header; dữ liệu vẫn là `course.status` từ backend. */
	const isPublished = course?.status === 'published';

	/** Công bố/ẩn khoá ngay ở header, dùng chung logic với nút trong tab "Thông tin khoá học". */
	const handleToggleStatus = async () => {
		if (!course) return;

		setIsTogglingStatus(true);
		try {
			const response = isPublished
				? await unpublishCourse(course.id)
				: await publishCourse(course.id);
			message.success(
				response.message ||
					(isPublished ? 'Đã ẩn khoá học' : 'Công bố khoá học thành công'),
			);
			reload();
		} catch (error) {
			// `400` khi công bố khoá chưa có bài học nào — câu tiếng Việt của backend.
			message.error(
				getApiErrorMessage(
					error,
					isPublished
						? 'Ẩn khoá học thất bại, vui lòng thử lại.'
						: 'Công bố khoá học thất bại, vui lòng thử lại.',
				),
			);
		} finally {
			setIsTogglingStatus(false);
		}
	};

	useEffect(() => {
		if (!courseId) {
			setCourse(null);
			setLoadError('Đường dẫn không có mã khoá học.');
			setIsLoading(false);
			return;
		}

		// Cờ `cancelled` chặn setState sau khi rời trang (đổi route khi request còn bay).
		let cancelled = false;

		const load = async () => {
			setIsLoading(true);
			// Lần nạp thứ hai trở đi là nạp ngầm: giữ nguyên nội dung đang xem và chỉ báo ở `Tabs`.
			setIsRefreshing(hasLoadedOnce.current);
			setLoadError('');

			try {
				const response = await getCourseById(courseId);
				if (cancelled) return;

				if (!response.data) {
					setCourse(null);
					setLoadError('Không tải được khoá học, vui lòng thử lại.');
					return;
				}

				setCourse(response.data);
			} catch (error) {
				if (cancelled) return;

				setCourse(null);
				// 403/404 kèm câu tiếng Việt của backend ("bạn không phụ trách khoá học này", …).
				setLoadError(
					getApiErrorMessage(
						error,
						'Không tải được khoá học, vui lòng thử lại.',
					),
				);
			} finally {
				if (!cancelled) {
					hasLoadedOnce.current = true;
					setIsLoading(false);
					setIsRefreshing(false);
				}
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [courseId, reloadKey]);

	// `Spin` toàn trang CHỈ ở lần nạp đầu; các lần nạp lại giữ nguyên cây tab (xem `hasLoadedOnce`).
	if (isLoading && !hasLoadedOnce.current) {
		return (
			<div className="flex min-h-[50vh] items-center justify-center p-gutter">
				<Spin size="large" />
			</div>
		);
	}

	if (!course || !courseId) {
		return (
			<div className="space-y-space-lg p-gutter">
				<h1 className="font-headline-lg font-headline-lg text-on-surface">
					Soạn thảo khoá học
				</h1>

				<div className="flex flex-wrap items-center gap-space-sm">
					<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
						{loadError || 'Không tải được khoá học, vui lòng thử lại.'}
					</ErrorBadge>
					<IOutLinedBtn onClick={reload}>Thử lại</IOutLinedBtn>
				</div>

				<Link to="/teacher/courses" className="text-secondary hover:underline">
					← Về danh sách khoá học
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-space-lg p-gutter">
			<div className="space-y-space-xs">
				<Link
					to="/teacher/courses"
					className="inline-flex items-center gap-1 font-label-md font-label-md text-secondary hover:underline"
				>
					<Icon name="arrow_back" size={16} />
					Danh sách khoá học
				</Link>

				<div className="flex flex-wrap items-center justify-between gap-space-sm">
					<div className="flex flex-wrap items-center gap-space-sm">
						<h1 className="font-headline-lg font-headline-lg text-on-surface">
							{course.code} — {course.title}
						</h1>
						<Badge
							status={getCourseStatusBadgeTone(course.status)}
							size="md"
							dot
						>
							{COURSE_PUBLISH_STATUS_LABEL[course.status]}
						</Badge>
					</div>

					{/* Cùng hành vi với cột thao tác ở trang danh sách và khối trạng thái trong tab
					    "Thông tin khoá học": `published` → ẩn, mọi trạng thái khác → công bố. */}
					{isPublished ? (
						<IOutLinedBtn
							size="small"
							loading={isTogglingStatus}
							onClick={() => void handleToggleStatus()}
						>
							Ẩn khoá học
						</IOutLinedBtn>
					) : (
						<ISolidBtn
							size="small"
							type="primary"
							background="primary"
							loading={isTogglingStatus}
							onClick={() => void handleToggleStatus()}
						>
							Công bố
						</ISolidBtn>
					)}
				</div>

				<p className="font-body-sm font-body-sm text-on-surface-variant">
					Phụ trách: {course.owner.fullName} · Cập nhật{' '}
					{dayjs(course.updatedAt).format('DD/MM/YYYY HH:mm')}
					{course.publishedAt
						? ` · Công bố ${dayjs(course.publishedAt).format('DD/MM/YYYY')}`
						: ' · Chưa công bố'}
				</p>
			</div>

			{loadError && (
				<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
					{loadError}
				</ErrorBadge>
			)}

			<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
				<Tabs
					// Không dùng `destroyOnHidden`: form metadata và ô chọn tiên quyết giữ nguyên
					// nội dung đang gõ khi người dùng qua lại giữa các tab.
					// `items` được dựng lại ở mỗi lần render nhưng `key` không đổi ⇒ React giữ
					// nguyên state của từng pane (không remount khi `course` được nạp lại).
					tabBarExtraContent={isRefreshing ? <Spin size="small" /> : undefined}
					items={[
						{
							key: 'metadata',
							label: 'Thông tin khoá học',
							children: (
								<CourseMetadataTab course={course} onChanged={reload} />
							),
						},
						{
							key: 'prerequisites',
							label: 'Điều kiện tiên quyết',
							children: (
								<CoursePrerequisitesTab
									courseId={courseId}
									prerequisites={course.prerequisites}
									onChanged={reload}
								/>
							),
						},
						{
							key: 'instructors',
							label: 'Giảng viên phụ trách',
							children: (
								<CourseInstructorsTab courseId={courseId} onChanged={reload} />
							),
						},
						{
							key: 'cohorts',
							label: 'Lớp học',
							children: (
								<CourseCohortsTab courseId={courseId} onChanged={reload} />
							),
						},
						{
							key: 'content',
							label: 'Nội dung',
							children: <CourseContentEditor courseId={courseId} />,
						},
					]}
				/>
			</div>
		</div>
	);
};

export default TeacherCourseEditorPage;
