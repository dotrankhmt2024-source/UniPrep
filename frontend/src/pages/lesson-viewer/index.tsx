import { useEffect, useMemo, useState } from 'react';
import { Spin } from 'antd';
import dayjs from 'dayjs';
import { Link, useNavigate, useParams } from 'react-router';
import { getCourseById } from '@/apis/course';
import { getLessonById, getLessons, getSections } from '@/apis/lesson';
import { getMaterials } from '@/apis/material';
import { Badge, ErrorBadge, Icon, IOutLinedBtn } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import type {
	CourseDetail,
	LessonDetail,
	LessonListItem,
	SectionListItem,
} from '@/types';
import { sanitizeHtml } from '@/utils/html';
import LessonOutline from './lesson-outline';
import MaterialList from './material-list';
import {
	LESSON_ERROR_MESSAGE,
	LESSON_NOT_FOUND_MESSAGE,
	buildLessonOutline,
	getHttpStatus,
	resolveSectionTitle,
	toPublishedLessonList,
} from './lesson-viewer.helpers';

/**
 * Nội dung bài học dưới dạng HTML.
 *
 * **Đây là chốt chặn XSS của trang.** `sanitizeHtml` lọc theo allowlist thẻ/thuộc tính mà TipTap
 * sinh ra trước khi đưa vào `dangerouslySetInnerHTML`; không được đổi thành `lesson.content` thô.
 *
 * Vì sao kiểm tra cả `contentFormat`: trường đó chỉ nói dữ liệu được *soạn* ở dạng nào, không bảo
 * đảm nội dung an toàn. `markdown`/`tiptap_json` là văn bản tự do nằm trong cùng cột `content` và
 * chế độ "Mã HTML" của TipTap cho phép gõ tay thẻ HTML — nên mọi định dạng đều đi qua `sanitizeHtml`
 * trước khi hiển thị; chỉ cách diễn giải là khác nhau.
 *
 * `[&_...]` của Tailwind 4 đặt typography cho các thẻ con vì nội dung được chèn bằng chuỗi HTML,
 * không phải bằng JSX nên không gắn class trực tiếp cho từng thẻ được. Không mượn `.rte-content`
 * của `styles/rich-text-editor.css`: các rule ở đó chỉ áp cho `.rte-content .tiptap` (do trình soạn
 * thảo sinh ra), nên ở đây chúng không có tác dụng gì.
 */
const LessonContent = ({ lesson }: { lesson: LessonDetail }) => (
	<div
		className="font-body-md font-body-md text-on-surface [&_a]:text-secondary [&_a]:underline [&_blockquote]:my-3 [&_blockquote]:border-l-4 [&_blockquote]:border-outline-variant [&_blockquote]:pl-4 [&_blockquote]:italic [&_blockquote]:text-on-surface-variant [&_code]:rounded [&_code]:bg-surface-container [&_code]:px-1 [&_code]:py-0.5 [&_h1]:mb-3 [&_h1]:mt-6 [&_h1]:text-headline-sm [&_h1]:font-bold [&_h2]:mb-2 [&_h2]:mt-5 [&_h2]:text-title-lg [&_h2]:font-bold [&_h3]:mb-2 [&_h3]:mt-4 [&_h3]:text-title-md [&_h3]:font-semibold [&_hr]:my-5 [&_hr]:border-outline-variant [&_li]:mb-1 [&_ol]:mb-3 [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:mb-3 [&_p]:leading-relaxed [&_pre]:mb-3 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface-container [&_pre]:p-3 [&_table]:mb-3 [&_table]:w-full [&_td]:border [&_td]:border-outline-variant [&_td]:p-2 [&_th]:border [&_th]:border-outline-variant [&_th]:bg-surface-container-low [&_th]:p-2 [&_th]:text-left [&_ul]:mb-3 [&_ul]:list-disc [&_ul]:pl-6"
		dangerouslySetInnerHTML={{ __html: sanitizeHtml(lesson.content) }}
	/>
);

/**
 * Trang xem nội dung bài học (E3-T8) — thay trang mock `pages/course-content`.
 *
 * Route: `/courses/:courseId/learn` (chưa chọn bài) và `/courses/:courseId/learn/:lessonId`.
 *
 * Ba quyết định đáng lưu ý:
 * 1. **Chỉ bài đã công bố mới tồn tại với người xem.** `lessonId` thiếu/sai ⇒ `navigate(..., {
 *    replace: true })` sang bài công bố đầu tiên theo `orderIndex`; không có bài nào ⇒ màn hình
 *    lỗi kèm đường về trang khoá học. `replace` để nút Back không quay lại URL sai vừa bị sửa.
 * 2. **Nội dung HTML bắt buộc đi qua `sanitizeHtml`** trước `dangerouslySetInnerHTML`: bài học do
 *    giảng viên soạn bằng TipTap và lưu HTML thô, render thẳng là lỗ hổng stored XSS cho mọi học
 *    viên mở bài (xem `utils/html.ts`).
 * 3. **Trước/sau tính trên danh sách đã công bố**, không phải trên `orderIndex` thô — nếu không,
 *    một bài nháp giữa hai bài công bố sẽ làm nút "Bài sau" trỏ vào chỗ không xem được.
 */
const LessonViewerPage = () => {
	const { courseId = '', lessonId } = useParams<{
		courseId: string;
		lessonId?: string;
	}>();
	const navigate = useNavigate();

	const [course, setCourse] = useState<CourseDetail | null>(null);
	const [sections, setSections] = useState<SectionListItem[]>([]);
	const [lessons, setLessons] = useState<LessonListItem[]>([]);
	const [isOutlineLoading, setIsOutlineLoading] = useState(true);
	const [outlineError, setOutlineError] = useState('');

	/** `lessonId` mà trang thực sự đang hiển thị — chỉ có sau khi đã kiểm tra với mục lục. */
	const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
	const [isResolvingLesson, setIsResolvingLesson] = useState(false);
	const [lesson, setLesson] = useState<LessonDetail | null>(null);
	const [fetchedMaterials, setFetchedMaterials] = useState<
		LessonDetail['materials'] | null
	>(null);
	const [isLessonLoading, setIsLessonLoading] = useState(false);
	const [lessonError, setLessonError] = useState('');

	// Chương đang mở trong mục lục; effect bên dưới tự mở thêm chương chứa bài đang xem.
	const [openSectionIds, setOpenSectionIds] = useState<string[]>([]);

	/** Khoá học + mục lục: hai nguồn độc lập nên chạy song song, một cái lỗi không chặn cái kia. */
	useEffect(() => {
		let cancelled = false;

		const load = async () => {
			setIsOutlineLoading(true);
			setOutlineError('');

			const [courseResult, sectionsResult, lessonsResult] =
				await Promise.allSettled([
					getCourseById(courseId),
					getSections(courseId, { take: 100 }),
					getLessons(courseId, {
						take: 100,
						sortBy: 'orderIndex',
						order: 'asc',
					}),
				]);

			if (cancelled) return;

			if (courseResult.status === 'fulfilled')
				setCourse(courseResult.value.data ?? null);

			// Mục lục là điều kiện tối thiểu để trang dùng được — thiếu nó thì không chọn được bài nào.
			if (lessonsResult.status === 'rejected') {
				setOutlineError(
					getApiErrorMessage(
						lessonsResult.reason,
						'Không tải được mục lục khoá học, vui lòng thử lại.',
					),
				);
			} else if (sectionsResult.status === 'rejected') {
				// Bài học vẫn hiển thị được (nhóm "Bài học khác"), nhưng mất tên chương nên vẫn báo lỗi.
				setOutlineError(
					getApiErrorMessage(
						sectionsResult.reason,
						'Không tải được mục lục khoá học, vui lòng thử lại.',
					),
				);
			} else {
				setSections(sectionsResult.value.data?.items ?? []);
				setLessons(lessonsResult.value.data?.items ?? []);
			}

			setIsOutlineLoading(false);
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [courseId]);

	/** Mục lục đã gộp chương; trải phẳng ra là **lộ trình** dùng cho chọn bài, trước/sau và "Bài x / y". */
	const outlineItems = useMemo(
		() => buildLessonOutline(sections, lessons),
		[sections, lessons],
	);
	const publishedLessons = useMemo(
		() => toPublishedLessonList(lessons),
		[lessons],
	);

	/**
	 * Kiểm tra `lessonId` trên URL với danh sách vừa tải rồi chốt bài đang xem.
	 *
	 * Cố ý **không** tin `lessonId` một cách mù quáng: id không nằm trong danh sách nghĩa là bài đã bị
	 * ẩn/xoá hoặc đường dẫn sai, và gọi `getLessonById` cho nó chỉ nhận 403/404 khó hiểu.
	 */
	useEffect(() => {
		if (isOutlineLoading || outlineError) return;

		if (lessonId && publishedLessons.some((item) => item.id === lessonId)) {
			setSelectedLessonId(lessonId);
			return;
		}

		setSelectedLessonId(null);

		if (publishedLessons.length === 0) return;

		setIsResolvingLesson(true);
		void navigate(`/courses/${courseId}/learn/${publishedLessons[0].id}`, {
			replace: true,
		});
	}, [
		courseId,
		isOutlineLoading,
		lessonId,
		navigate,
		outlineError,
		publishedLessons,
	]);

	/**
	 * Tải chi tiết bài đang chọn.
	 *
	 * `getMaterials` chạy song song dù `LessonDetail.materials` đã có sẵn: nếu endpoint chi tiết đổi
	 * hình dạng (bỏ `materials`), danh sách học liệu vẫn hiển thị. Lỗi của nó không làm hỏng trang.
	 */
	useEffect(() => {
		if (!selectedLessonId) {
			setLesson(null);
			setFetchedMaterials(null);
			setLessonError('');
			setIsResolvingLesson(false);
			return;
		}

		let cancelled = false;

		const load = async () => {
			setIsLessonLoading(true);
			setLessonError('');
			setLesson(null);
			setFetchedMaterials(null);

			const [lessonResult, materialsResult] = await Promise.allSettled([
				getLessonById(selectedLessonId),
				getMaterials(selectedLessonId),
			]);

			if (cancelled) return;

			if (lessonResult.status === 'fulfilled') {
				setLesson(lessonResult.value.data ?? null);
				if (!lessonResult.value.data)
					setLessonError('Không tải được nội dung bài học, vui lòng thử lại.');
			} else {
				// 403 = chưa ghi danh HOẶC bài/khoá chưa công bố (backend gộp cả hai vào một câu để
				// không tiết lộ bài nháp có tồn tại hay không). 404 = id không tồn tại.
				const status = getHttpStatus(lessonResult.reason);
				setLessonError(
					status !== null && LESSON_ERROR_MESSAGE[status]
						? LESSON_ERROR_MESSAGE[status]
						: getApiErrorMessage(
								lessonResult.reason,
								'Không tải được nội dung bài học, vui lòng thử lại.',
							),
				);
			}

			if (materialsResult.status === 'fulfilled') {
				setFetchedMaterials(materialsResult.value.data?.items ?? []);
			}

			setIsLessonLoading(false);
			setIsResolvingLesson(false);
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [selectedLessonId]);

	/** Mở sẵn chương chứa bài đang xem, nhưng **không** đóng các chương người dùng đã mở. */
	useEffect(() => {
		if (!lesson?.sectionId) return;
		setOpenSectionIds((keys) =>
			keys.includes(lesson.sectionId) ? keys : [...keys, lesson.sectionId],
		);
	}, [lesson?.sectionId]);

	/** `null` (chưa gọi xong) khác `[]` (gọi xong nhưng rỗng): rỗng thì dùng luôn `lesson.materials`. */
	const materials = fetchedMaterials?.length
		? fetchedMaterials
		: (lesson?.materials ?? []);

	const activeLessonIndex = selectedLessonId
		? publishedLessons.findIndex((item) => item.id === selectedLessonId)
		: -1;
	// `null` khi không có bài trước/sau: nút tương ứng bị `disabled` thay vì trỏ về `undefined`.
	const previousLesson =
		activeLessonIndex > 0 ? publishedLessons[activeLessonIndex - 1] : null;
	const nextLesson =
		activeLessonIndex >= 0 && activeLessonIndex < publishedLessons.length - 1
			? publishedLessons[activeLessonIndex + 1]
			: null;

	const goToLesson = (id: string) => {
		void navigate(`/courses/${courseId}/learn/${id}`);
	};

	const backToCourseLink = (
		<Link
			to={`/courses/${courseId}`}
			className="text-secondary hover:underline"
		>
			← Về trang khoá học
		</Link>
	);

	if (isOutlineLoading) {
		return (
			<div className="flex min-h-[50vh] items-center justify-center p-gutter">
				<Spin size="large" />
			</div>
		);
	}

	if (outlineError) {
		return (
			<div className="space-y-space-lg p-gutter">
				<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
					{outlineError}
				</ErrorBadge>
				{backToCourseLink}
			</div>
		);
	}

	if (publishedLessons.length === 0) {
		return (
			<div className="space-y-space-lg p-gutter">
				<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
					Khoá học chưa có bài học nào được công bố.
				</ErrorBadge>
				{backToCourseLink}
			</div>
		);
	}

	if (!selectedLessonId || isResolvingLesson) {
		// Đang tự chuyển sang bài đầu tiên — chỉ là khoảnh khắc, nhưng phải có gì đó thay vì khung trắng.
		return (
			<div className="flex min-h-[50vh] items-center justify-center p-gutter">
				<Spin size="large" />
			</div>
		);
	}

	return (
		<div className="space-y-space-lg p-gutter">
			<div className="flex flex-wrap items-center justify-between gap-space-sm">
				{backToCourseLink}
				{course && (
					<div className="flex flex-wrap items-center gap-2">
						<Badge status="info" size="md">
							{course.code}
						</Badge>
						<span className="font-title-md font-title-md text-on-surface">
							{course.title}
						</span>
					</div>
				)}
			</div>

			<div className="grid grid-cols-1 items-start gap-space-lg lg:grid-cols-12">
				<div className="lg:col-span-4 xl:col-span-3">
					<LessonOutline
						outline={outlineItems}
						activeLessonId={selectedLessonId}
						openSectionIds={openSectionIds}
						onOpenSectionChange={setOpenSectionIds}
						onSelectLesson={goToLesson}
					/>
				</div>

				<div className="min-w-0 space-y-space-lg lg:col-span-8 xl:col-span-9">
					{isLessonLoading && !lesson ? (
						<div className="flex min-h-[40vh] items-center justify-center rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
							<Spin size="large" />
						</div>
					) : lessonError || !lesson ? (
						<div className="space-y-space-lg rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
							<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
								{lessonError || LESSON_NOT_FOUND_MESSAGE}
							</ErrorBadge>
							{backToCourseLink}
						</div>
					) : (
						<>
							<article className="space-y-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-lg shadow-sm">
								<div className="flex flex-wrap items-center gap-2">
									{/* `section.title` của chi tiết là nguồn chính; mục lục là dự phòng. */}
									<Badge status="info">
										{resolveSectionTitle(lesson, outlineItems)}
									</Badge>
									{lesson.estimatedMinutes !== null && (
										<Badge status="neutral">
											{lesson.estimatedMinutes} phút
										</Badge>
									)}
									{lesson.dueAt && (
										<Badge
											status="warning"
											icon={<Icon name="event" size={14} />}
										>
											Hạn {dayjs(lesson.dueAt).format('DD/MM/YYYY HH:mm')}
										</Badge>
									)}
								</div>

								<h1 className="font-headline-md font-headline-md text-on-surface">
									{lesson.title}
								</h1>

								{lesson.summary && (
									<p className="font-body-md font-body-md text-on-surface-variant">
										{lesson.summary}
									</p>
								)}

								{lesson.content ? (
									<LessonContent lesson={lesson} />
								) : (
									<div className="rounded-lg border border-dashed border-outline-variant p-space-lg text-center">
										<Icon name="article" size={28} className="text-outline" />
										<p className="font-body-md font-body-md text-on-surface-variant">
											Bài học này chưa có nội dung.
										</p>
									</div>
								)}
							</article>

							{materials.length > 0 && <MaterialList materials={materials} />}

							<nav className="flex flex-wrap items-center justify-between gap-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
								<IOutLinedBtn
									icon={<Icon name="arrow_back" size={16} />}
									disabled={!previousLesson}
									onClick={() =>
										previousLesson && goToLesson(previousLesson.id)
									}
								>
									Bài trước
								</IOutLinedBtn>

								<span className="font-label-md font-label-md text-on-surface-variant">
									Bài {activeLessonIndex + 1} / {publishedLessons.length}
								</span>

								<IOutLinedBtn
									disabled={!nextLesson}
									onClick={() => nextLesson && goToLesson(nextLesson.id)}
								>
									Bài sau
									<Icon name="arrow_forward" size={16} />
								</IOutLinedBtn>
							</nav>
						</>
					)}
				</div>
			</div>
		</div>
	);
};

export default LessonViewerPage;
