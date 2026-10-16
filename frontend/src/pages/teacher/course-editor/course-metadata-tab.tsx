import { useEffect, useMemo, useState } from 'react';
import { Form, Input, InputNumber, Select, Switch, message } from 'antd';
import dayjs from 'dayjs';
import { getCategories } from '@/apis/category';
import { publishCourse, unpublishCourse, updateCourse } from '@/apis/course';
import {
	Badge,
	ErrorBadge,
	FormItem,
	Icon,
	IOutLinedBtn,
	ISolidBtn,
} from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import { useAppSelector } from '@/store/hooks';
import {
	COURSE_LEVEL_LABEL,
	COURSE_PUBLISH_STATUS_LABEL,
	COURSE_VISIBILITY_LABEL,
	type Category,
	type CourseDetail,
	type CourseLevel,
	type CourseVisibility,
	type UpdateCoursePayload,
} from '@/types';
import { getCourseStatusBadgeTone } from '@/utils/course';

/**
 * Tab "Thông tin khoá học" của trang soạn thảo (E3-T9).
 *
 * Ba quyết định đáng chú ý:
 *
 * 1. **Chỉ gửi trường thực sự đổi.** `PATCH /api/courses/:id` ghi theo `!== undefined`, nên gửi
 *    nguyên form sẽ vô tình ghi đè những trường người dùng không đụng tới (và làm `updatedAt` nhảy
 *    dù chẳng có gì mới). `snapshotRef` giữ bản gốc của lần nạp gần nhất để so sánh từng trường.
 * 2. **Ô văn bản để trống ⇒ gửi `null`, không phải chuỗi rỗng.** Các cột này nullable trong DB;
 *    `null` là cách duy nhất để "xoá" giá trị, còn `''` sẽ lưu chuỗi rỗng vào cột.
 * 3. **`description` là `Input.TextArea` thuần, không phải TipTap.** Cột `courses.description` là
 *    `text`; trình soạn thảo rich-text chỉ dành cho nội dung bài học (do trang `content-editor`
 *    phụ trách).
 */
export interface CourseMetadataTabProps {
	course: CourseDetail;
	/** Gọi sau mỗi lần ghi thành công để trang cha nạp lại chi tiết khoá học. */
	onChanged: () => void;
}

interface MetadataFormValues {
	code: string;
	title: string;
	summary?: string;
	description?: string;
	categoryId?: string;
	semester?: string;
	level?: CourseLevel;
	visibility: CourseVisibility;
	language?: string;
	estimatedHours?: number | null;
	enrollmentOpen: boolean;
	maxStudents?: number | null;
	coverUrl?: string;
	ownerId?: string;
}

const LEVEL_OPTIONS = (Object.keys(COURSE_LEVEL_LABEL) as CourseLevel[]).map(
	(level) => ({ value: level, label: COURSE_LEVEL_LABEL[level] }),
);

const VISIBILITY_OPTIONS = (
	Object.keys(COURSE_VISIBILITY_LABEL) as CourseVisibility[]
).map((visibility) => ({
	value: visibility,
	label: COURSE_VISIBILITY_LABEL[visibility],
}));

/** `null` của API ↔ `undefined` của form để ô trống thực sự trống thay vì hiện chuỗi "null". */
const toFormValues = (course: CourseDetail): MetadataFormValues => ({
	code: course.code,
	title: course.title,
	summary: course.summary ?? undefined,
	description: course.description ?? undefined,
	categoryId: course.category?.id ?? undefined,
	semester: course.semester ?? undefined,
	level: course.level ?? undefined,
	visibility: course.visibility,
	language: course.language ?? undefined,
	estimatedHours: course.estimatedHours ?? undefined,
	enrollmentOpen: course.enrollmentOpen,
	maxStudents: course.maxStudents ?? undefined,
	coverUrl: course.coverUrl ?? undefined,
	ownerId: course.owner.id,
});

/** `text` rỗng ⇒ `null` (xoá giá trị), ngược lại là chuỗi đã cắt khoảng trắng. */
const textOrNull = (value: string | undefined): string | null =>
	value?.trim() ? value.trim() : null;

const CourseMetadataTab = ({ course, onChanged }: CourseMetadataTabProps) => {
	const [form] = Form.useForm<MetadataFormValues>();
	const currentUserRole = useAppSelector((state) => state.auth.user?.role);
	const isAdmin = currentUserRole === 'admin';

	const [snapshot, setSnapshot] = useState<MetadataFormValues>(() =>
		toFormValues(course),
	);
	const [categories, setCategories] = useState<Category[]>([]);
	const [isSaving, setIsSaving] = useState(false);
	const [isPublishing, setIsPublishing] = useState(false);
	const [saveError, setSaveError] = useState('');
	/**
	 * `form.getFieldsValue()` là hàm đọc **không theo dõi**: antd không làm component này re-render
	 * khi người dùng gõ. Vì vậy giá trị đang nhập được giữ song song trong state `draft`, cập nhật
	 * qua `onValuesChange` — đó là thứ duy nhất khiến nút "Lưu thay đổi" bật/tắt đúng lúc.
	 */
	const [draft, setDraft] = useState<MetadataFormValues>(() =>
		toFormValues(course),
	);

	// `course` đổi sau mỗi lần `onChanged()` ⇒ nạp lại form, mốc so sánh và bản nháp. `useEffect`
	// (thay vì `useMemo`) là bắt buộc vì `form.setFieldsValue` là hiệu ứng phụ, không phải giá trị
	// dẫn xuất.
	useEffect(() => {
		const next = toFormValues(course);
		setSnapshot(next);
		setDraft(next);
		form.resetFields();
		form.setFieldsValue(next);
	}, [course, form]);

	useEffect(() => {
		let cancelled = false;

		const loadCategories = async () => {
			try {
				const response = await getCategories({ take: 100, sortBy: 'name' });
				if (!cancelled) setCategories(response.data?.items ?? []);
			} catch (error) {
				if (cancelled) return;
				// Danh mục chỉ là dữ liệu cho ô chọn: lỗi ở đây không chặn việc sửa các trường khác.
				message.error(
					getApiErrorMessage(error, 'Không tải được danh sách danh mục.'),
				);
			}
		};

		void loadCategories();

		return () => {
			cancelled = true;
		};
	}, []);

	const isPublished = course.status === 'published';

	/** Danh sách trường thực sự khác bản gốc — dùng cả để gửi API lẫn để bật/tắt nút "Lưu". */
	const changedPayload = useMemo((): UpdateCoursePayload => {
		const values = draft;
		const payload: UpdateCoursePayload = {};
		const code = values.code?.trim() ?? '';
		if (code && code !== snapshot.code) payload.code = code;

		const title = values.title?.trim() ?? '';
		if (title && title !== snapshot.title) payload.title = title;

		const summary = textOrNull(values.summary);
		if (summary !== (snapshot.summary ?? null)) payload.summary = summary;

		const description = textOrNull(values.description);
		if (description !== (snapshot.description ?? null)) {
			payload.description = description;
		}

		const categoryId = values.categoryId ?? null;
		if (categoryId !== (snapshot.categoryId ?? null)) {
			payload.categoryId = categoryId;
		}

		const semester = textOrNull(values.semester);
		if (semester !== (snapshot.semester ?? null)) payload.semester = semester;

		const level = values.level ?? null;
		if (level !== (snapshot.level ?? null)) payload.level = level;

		if (values.visibility !== snapshot.visibility) {
			payload.visibility = values.visibility;
		}

		const language = values.language?.trim() ?? '';
		if (language && language !== (snapshot.language ?? '')) {
			payload.language = language;
		}

		const estimatedHours = values.estimatedHours ?? null;
		if (estimatedHours !== (snapshot.estimatedHours ?? null)) {
			payload.estimatedHours = estimatedHours;
		}

		if (values.enrollmentOpen !== snapshot.enrollmentOpen) {
			payload.enrollmentOpen = values.enrollmentOpen;
		}

		const maxStudents = values.maxStudents ?? null;
		if (maxStudents !== (snapshot.maxStudents ?? null)) {
			payload.maxStudents = maxStudents;
		}

		const coverUrl = textOrNull(values.coverUrl);
		if (coverUrl !== (snapshot.coverUrl ?? null)) payload.coverUrl = coverUrl;

		// `ownerId` chỉ admin đổi được: backend trả **403** nếu `teacher` gửi trường này, nên với
		// giảng viên trường đó không bao giờ vào payload dù form có giá trị.
		if (isAdmin) {
			const ownerId = values.ownerId?.trim() ?? '';
			if (ownerId && ownerId !== (snapshot.ownerId ?? '')) {
				payload.ownerId = ownerId;
			}
		}

		return payload;
	}, [draft, snapshot, isAdmin]);

	const hasChanges = Object.keys(changedPayload).length > 0;

	// Tham số của antd chỉ dùng để chạy validate; payload thật lấy từ `changedPayload` (đã so với
	// bản gốc) nên cố ý không đọc `values` ở đây.
	const handleSubmit = async () => {
		if (!hasChanges) {
			message.info('Không có thay đổi nào để lưu.');
			return;
		}

		setIsSaving(true);
		setSaveError('');

		try {
			const response = await updateCourse(course.id, changedPayload);
			message.success(response.message || 'Cập nhật khoá học thành công');
			onChanged();
		} catch (error) {
			// 409 (trùng `code`/`slug`) và 403 (`teacher` gửi `ownerId` — lỗi lập trình ở FE) đều
			// kèm câu tiếng Việt của backend; hiện nguyên văn thay vì đoán.
			setSaveError(
				getApiErrorMessage(
					error,
					'Cập nhật khoá học thất bại, vui lòng thử lại.',
				),
			);
		} finally {
			setIsSaving(false);
		}
	};

	const handlePublishToggle = async () => {
		setIsPublishing(true);
		setSaveError('');

		try {
			const response = isPublished
				? await unpublishCourse(course.id)
				: await publishCourse(course.id);
			message.success(
				response.message ||
					(isPublished ? 'Đã ẩn khoá học' : 'Công bố khoá học thành công'),
			);
			onChanged();
		} catch (error) {
			// `400` khi công bố khoá chưa có bài học nào — câu tiếng Việt của backend.
			setSaveError(
				getApiErrorMessage(
					error,
					isPublished
						? 'Ẩn khoá học thất bại, vui lòng thử lại.'
						: 'Công bố khoá học thất bại, vui lòng thử lại.',
				),
			);
		} finally {
			setIsPublishing(false);
		}
	};

	return (
		<div className="space-y-space-lg">
			<div className="flex flex-wrap items-center gap-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
				<span className="font-label-md font-label-md text-on-surface-variant">
					Trạng thái
				</span>
				<Badge status={getCourseStatusBadgeTone(course.status)} size="md" dot>
					{COURSE_PUBLISH_STATUS_LABEL[course.status]}
				</Badge>

				<span className="font-label-sm font-label-sm text-on-surface-variant">
					{course.publishedAt
						? `Công bố lần đầu: ${dayjs(course.publishedAt).format('DD/MM/YYYY HH:mm')}`
						: 'Chưa từng được công bố'}
				</span>

				<div className="ml-auto">
					{isPublished ? (
						<IOutLinedBtn
							size="small"
							loading={isPublishing}
							onClick={() => void handlePublishToggle()}
						>
							Ẩn khoá học
						</IOutLinedBtn>
					) : (
						<ISolidBtn
							size="small"
							type="primary"
							background="primary"
							loading={isPublishing}
							onClick={() => void handlePublishToggle()}
						>
							Công bố
						</ISolidBtn>
					)}
				</div>
			</div>

			{saveError && (
				<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
					{saveError}
				</ErrorBadge>
			)}

			<Form<MetadataFormValues>
				form={form}
				layout="vertical"
				requiredMark={false}
				onFinish={handleSubmit}
				// Mọi thay đổi đều phải vẽ lại nút "Lưu thay đổi" (disabled theo `hasChanges`) và
				// bộ đếm trường đã đổi, nên giữ luôn giá trị đang nhập trong state `draft`.
				onValuesChange={(_changed, allValues) => setDraft(allValues)}
			>
				<div className="grid grid-cols-1 gap-x-space-lg md:grid-cols-2">
					<FormItem
						formItemProps={{ label: 'Mã môn', name: 'code' }}
						rules={[
							{ required: true, message: 'Mã môn không được để trống' },
							{ max: 50, message: 'Mã môn tối đa 50 ký tự' },
							{
								pattern: /^[A-Za-z0-9._-]+$/,
								message:
									'Mã môn chỉ gồm chữ, số, dấu gạch, chấm hoặc gạch dưới.',
							},
						]}
					/>

					<FormItem
						formItemProps={{ label: 'Học kỳ', name: 'semester' }}
						inputProps={{ placeholder: '1/2026-2027' }}
						rules={[{ max: 20, message: 'Học kỳ tối đa 20 ký tự' }]}
					/>
				</div>

				<FormItem
					formItemProps={{ label: 'Tên khoá học', name: 'title' }}
					rules={[
						{ required: true, message: 'Tên khoá học không được để trống' },
						{ min: 3, message: 'Tên khoá học phải có ít nhất 3 ký tự' },
						{ max: 255, message: 'Tên khoá học tối đa 255 ký tự' },
					]}
				/>

				<FormItem
					formItemProps={{ label: 'Mô tả ngắn', name: 'summary' }}
					rules={[{ max: 500, message: 'Mô tả ngắn tối đa 500 ký tự' }]}
				>
					<Input.TextArea
						rows={2}
						maxLength={500}
						showCount
						placeholder="Một hai câu xuất hiện ở thẻ khoá học trong catalog…"
					/>
				</FormItem>

				<FormItem
					formItemProps={{ label: 'Đề cương', name: 'description' }}
					rules={[{ max: 20000, message: 'Đề cương tối đa 20000 ký tự' }]}
				>
					<Input.TextArea
						rows={8}
						maxLength={20000}
						showCount
						placeholder="Mục tiêu, nội dung, tài liệu tham khảo… (văn bản thuần)"
					/>
				</FormItem>

				<div className="grid grid-cols-1 gap-x-space-lg md:grid-cols-3">
					<FormItem formItemProps={{ label: 'Danh mục', name: 'categoryId' }}>
						<Select
							allowClear
							size="large"
							placeholder="Chọn danh mục"
							options={categories.map((category) => ({
								value: category.id,
								label: category.name,
							}))}
						/>
					</FormItem>

					<FormItem formItemProps={{ label: 'Trình độ', name: 'level' }}>
						<Select
							allowClear
							size="large"
							placeholder="Chọn trình độ"
							options={LEVEL_OPTIONS}
						/>
					</FormItem>

					<FormItem
						formItemProps={{ label: 'Chế độ hiển thị', name: 'visibility' }}
					>
						<Select size="large" options={VISIBILITY_OPTIONS} />
					</FormItem>
				</div>

				<div className="grid grid-cols-1 gap-x-space-lg md:grid-cols-3">
					<FormItem
						formItemProps={{ label: 'Ngôn ngữ', name: 'language' }}
						inputProps={{ placeholder: 'vi' }}
						rules={[{ max: 10, message: 'Ngôn ngữ tối đa 10 ký tự' }]}
					/>

					<FormItem
						formItemProps={{ label: 'Số giờ dự kiến', name: 'estimatedHours' }}
					>
						<InputNumber
							size="large"
							className="w-full"
							min={0}
							max={9999}
							step={1}
							placeholder="45"
						/>
					</FormItem>

					<FormItem
						formItemProps={{ label: 'Sĩ số tối đa', name: 'maxStudents' }}
					>
						<InputNumber
							size="large"
							className="w-full"
							min={1}
							step={1}
							placeholder="Để trống = không giới hạn"
						/>
					</FormItem>
				</div>

				<FormItem formItemProps={{ label: 'Ảnh bìa (URL)', name: 'coverUrl' }}>
					<Input size="large" placeholder="https://…" />
				</FormItem>

				<FormItem
					formItemProps={{
						label: 'Mở đăng ký',
						name: 'enrollmentOpen',
						valuePropName: 'checked',
					}}
				>
					<Switch />
				</FormItem>

				{isAdmin && (
					<FormItem
						formItemProps={{
							label: 'Giảng viên phụ trách (chỉ quản trị viên)',
							name: 'ownerId',
							extra:
								'Đổi chủ sở hữu sẽ đồng bộ luôn dòng phân công "Phụ trách chính". Dán UUID của giảng viên.',
						}}
					>
						<Input size="large" placeholder="UUID giảng viên" />
					</FormItem>
				)}

				<div className="flex flex-wrap items-center justify-end gap-space-sm">
					{hasChanges && (
						<span className="font-label-sm font-label-sm text-on-surface-variant">
							{Object.keys(changedPayload).length} trường sẽ được gửi
						</span>
					)}

					<IOutLinedBtn
						disabled={!hasChanges || isSaving}
						onClick={() => {
							form.resetFields();
							form.setFieldsValue(snapshot);
							setDraft(snapshot);
						}}
					>
						Hoàn tác
					</IOutLinedBtn>

					<ISolidBtn
						type="primary"
						background="primary"
						htmlType="submit"
						loading={isSaving}
						disabled={!hasChanges}
					>
						Lưu thay đổi
					</ISolidBtn>
				</div>
			</Form>
		</div>
	);
};

export default CourseMetadataTab;
