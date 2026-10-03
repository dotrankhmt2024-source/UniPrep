import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
	Alert,
	DatePicker,
	Form,
	Input,
	InputNumber,
	Modal,
	Skeleton,
	Spin,
	Switch,
	Tooltip,
	Upload,
	message,
} from 'antd';
import type { UploadFile } from 'antd';
import {
	ArrowDownOutlined,
	ArrowUpOutlined,
	DeleteOutlined,
	EyeInvisibleOutlined,
	PlusOutlined,
	UploadOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import {
	createLesson,
	createSection,
	deleteLesson,
	deleteSection,
	getLessonById,
	getLessons,
	getSections,
	hideLesson,
	publishLesson,
	reorderLessons,
	reorderSections,
	updateLesson,
	updateSection,
} from '@/apis/lesson';
import { deleteMaterial, getMaterials, uploadMaterial } from '@/apis/material';
import {
	Badge,
	ErrorBadge,
	FormItem,
	Icon,
	IconBtn,
	IOutLinedBtn,
	ISolidBtn,
	RichTextEditor,
} from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import {
	LESSON_DERIVED_TYPE_LABEL,
	MATERIAL_TYPE_LABEL,
	type CreateLessonPayload,
	type LessonDetail,
	type LessonListItem,
	type MaterialItem,
	type MaterialType,
	type SectionListItem,
	type UpdateLessonPayload,
} from '@/types';
import {
	formatDuration,
	formatFileSize,
	getMaterialTypeBadgeTone,
} from '@/utils/course';

/**
 * E3-T9 (phần 2) — Trình soạn **nội dung** khoá học của giảng viên.
 *
 * Bố cục hai cột: trái là mục lục (chương + bài học) kèm thao tác quản lý, phải là trình soạn bài
 * học đang chọn (hoặc trạng thái rỗng). Ở màn hẹp hai cột tự xếp chồng.
 *
 * Ba quyết định quan trọng:
 * 1. **Hai lời gọi tải riêng** (`/sections` và `/lessons`) rồi ghép ở client — API không có endpoint
 *    trả sẵn cây chương/bài, và `take: 100` là đủ cho một khoá học thực tế.
 * 2. **Không dùng `LessonListItem` để sửa**: phần tử trong danh sách không có `content`, nên cột
 *    phải gọi `getLessonById(id)` mới lấy được thân bài (TipTap HTML) và `contentFormat`.
 * 3. **Reorder luôn gửi danh sách ĐẦY ĐỦ**: xem `buildSectionOrder` / `buildLessonOrder`.
 */

/** Trần số bản ghi mỗi lần tải mục lục — một khoá học hiếm khi vượt quá. */
const OUTLINE_TAKE = 100;

/**
 * `dayjs` (không phải `string`) vì antd `DatePicker` làm việc với đối tượng Dayjs;
 * chỉ khi gọi API mới đổi sang ISO bằng `toISOString()`.
 */
const toDayjs = (value: string | null): Dayjs | null =>
	value ? dayjs(value) : null;

/** Dấu phân cách ngày/giờ của `DatePicker`; khớp định dạng hiển thị của antd. */
const DATE_TIME_FORMAT = 'DD/MM/YYYY HH:mm';

const MATERIAL_ICON: Record<MaterialType, string> = {
	text: 'description',
	slide: 'slideshow',
	video: 'play_circle',
	file: 'draft',
	link: 'link',
};

interface ChapterItem {
	section: SectionListItem;
	lessons: LessonListItem[];
}

/** Giá trị form của modal chương. */
interface ChapterFormValues {
	title: string;
	description?: string;
	isPublished?: boolean;
}

/** Giá trị form của modal bài học. */
interface LessonFormValues {
	title: string;
	summary?: string;
	estimatedMinutes?: number | null;
	isPublished?: boolean;
}

/** Giá trị form ở cột phải; `content` là HTML do TipTap sinh ra. */
interface LessonEditorFormValues {
	title: string;
	summary?: string;
	estimatedMinutes?: number | null;
	dueAt?: Dayjs | null;
	availableFrom?: Dayjs | null;
	isPublished?: boolean;
	content?: string;
}

/**
 * `GET /sections` đã sắp theo `orderIndex`, nhưng vẫn sắp lại ở client để bất biến "chương luôn
 * theo `orderIndex`" không phụ thuộc vào thứ tự backend trả về.
 */
const sortByOrderIndex = <T extends { orderIndex: number }>(rows: T[]): T[] =>
	[...rows].sort((left, right) => left.orderIndex - right.orderIndex);

const groupLessonsBySection = (
	lessons: LessonListItem[],
): Record<string, LessonListItem[]> =>
	lessons.reduce<Record<string, LessonListItem[]>>((accumulator, lesson) => {
		(accumulator[lesson.sectionId] ??= []).push(lesson);
		return accumulator;
	}, {});

/**
 * Payload cho `reorderSections`: đổi chỗ hai chương liền kề trong danh sách **đã sắp đầy đủ**, rồi
 * đánh lại `orderIndex` liên tục từ 1. API yêu cầu danh sách ĐẦY ĐỦ và liên tục từ 1 (không phải
 * "dịch chuyển một phần tử"), nếu không sẽ trả 400 và thứ tự có thể nửa vời.
 */
const buildSectionOrder = (
	sections: SectionListItem[],
	fromIndex: number,
	toIndex: number,
): { items: { id: string; orderIndex: number }[] } => {
	const reordered = [...sections];
	const [moved] = reordered.splice(fromIndex, 1);
	reordered.splice(toIndex, 0, moved);

	return {
		items: reordered.map((section, index) => ({
			id: section.id,
			orderIndex: index + 1,
		})),
	};
};

/** Cùng quy tắc với `buildSectionOrder`, nhưng trong phạm vi một chương. */
const buildLessonOrder = (
	lessons: LessonListItem[],
	fromIndex: number,
	toIndex: number,
): { items: { id: string; orderIndex: number }[] } => {
	const reordered = [...lessons];
	const [moved] = reordered.splice(fromIndex, 1);
	reordered.splice(toIndex, 0, moved);

	return {
		items: reordered.map((lesson, index) => ({
			id: lesson.id,
			orderIndex: index + 1,
		})),
	};
};

/** Trạng thái chưa công bố — dùng chung cho chương và bài học. */
const UnpublishedBadge = () => (
	<Badge status="warning" size="sm">
		Chưa công bố
	</Badge>
);

interface ChapterFormModalProps {
	open: boolean;
	/** `null` = tạo mới; có giá trị = đang sửa chương đó. */
	editing: SectionListItem | null;
	isSubmitting: boolean;
	onCancel: () => void;
	onSubmit: (values: ChapterFormValues) => void;
}

/** Modal tạo/sửa chương — dùng lại cho cả hai thao tác vì trường giống hệt nhau. */
const ChapterFormModal = ({
	open,
	editing,
	isSubmitting,
	onCancel,
	onSubmit,
}: ChapterFormModalProps) => {
	const [form] = Form.useForm<ChapterFormValues>();
	const isEditing = !!editing;

	useEffect(() => {
		if (!open) return;

		form.setFieldsValue({
			title: editing?.title ?? '',
			description: editing?.description ?? '',
			isPublished: editing?.isPublished ?? true,
		});
	}, [open, editing, form]);

	return (
		<Modal
			open={open}
			title={isEditing ? 'Sửa chương' : 'Thêm chương'}
			footer={null}
			destroyOnHidden
			onCancel={onCancel}
		>
			<Form<ChapterFormValues>
				form={form}
				layout="vertical"
				className="space-y-space-sm pt-space-sm"
				onFinish={onSubmit}
			>
				<FormItem
					formItemProps={{ label: 'Tên chương', name: 'title' }}
					rules={[{ required: true, message: 'Vui lòng nhập tên chương.' }]}
					inputProps={{ placeholder: 'Ví dụ: Chương 1 — Giới thiệu' }}
				/>

				<FormItem
					formItemProps={{ label: 'Mô tả', name: 'description' }}
					inputProps={{
						placeholder: 'Tóm tắt ngắn về nội dung chương (không bắt buộc).',
					}}
				/>

				<FormItem
					formItemProps={{
						label: 'Công bố chương',
						name: 'isPublished',
						valuePropName: 'checked',
					}}
				>
					<Switch checkedChildren="Công bố" unCheckedChildren="Ẩn" />
				</FormItem>

				<div className="flex justify-end gap-space-sm">
					<IOutLinedBtn onClick={onCancel}>Huỷ bỏ</IOutLinedBtn>
					<ISolidBtn htmlType="submit" loading={isSubmitting}>
						{isEditing ? 'Lưu thay đổi' : 'Tạo chương'}
					</ISolidBtn>
				</div>
			</Form>
		</Modal>
	);
};

interface LessonFormModalProps {
	open: boolean;
	/** Chương sẽ nhận bài học mới. */
	section: SectionListItem | null;
	isSubmitting: boolean;
	onCancel: () => void;
	onSubmit: (values: LessonFormValues) => void;
}

/** Modal "Thêm bài học" trong một chương. */
const LessonFormModal = ({
	open,
	section,
	isSubmitting,
	onCancel,
	onSubmit,
}: LessonFormModalProps) => {
	const [form] = Form.useForm<LessonFormValues>();

	useEffect(() => {
		if (!open) return;

		form.setFieldsValue({
			title: '',
			summary: '',
			estimatedMinutes: null,
			isPublished: false,
		});
	}, [open, form]);

	return (
		<Modal
			open={open}
			title={section ? `Thêm bài học — ${section.title}` : 'Thêm bài học'}
			footer={null}
			destroyOnHidden
			onCancel={onCancel}
		>
			<Form<LessonFormValues>
				form={form}
				layout="vertical"
				className="space-y-space-sm pt-space-sm"
				onFinish={onSubmit}
			>
				<FormItem
					formItemProps={{ label: 'Tên bài học', name: 'title' }}
					rules={[{ required: true, message: 'Vui lòng nhập tên bài học.' }]}
					inputProps={{ placeholder: 'Ví dụ: Bài 1 — Đạo hàm và ứng dụng' }}
				/>

				<FormItem
					formItemProps={{ label: 'Tóm tắt', name: 'summary' }}
					inputProps={{
						placeholder: 'Một hai câu mô tả nội dung bài học (không bắt buộc).',
					}}
				/>

				<FormItem
					formItemProps={{
						label: 'Thời lượng dự kiến (phút)',
						name: 'estimatedMinutes',
					}}
				>
					<InputNumber
						className="w-full"
						size="large"
						min={0}
						max={6000}
						placeholder="Ví dụ: 45"
					/>
				</FormItem>

				<FormItem
					formItemProps={{
						label: 'Công bố ngay',
						name: 'isPublished',
						valuePropName: 'checked',
					}}
				>
					<Switch checkedChildren="Công bố" unCheckedChildren="Ẩn" />
				</FormItem>

				<div className="flex justify-end gap-space-sm">
					<IOutLinedBtn onClick={onCancel}>Huỷ bỏ</IOutLinedBtn>
					<ISolidBtn htmlType="submit" loading={isSubmitting}>
						Tạo bài học
					</ISolidBtn>
				</div>
			</Form>
		</Modal>
	);
};

interface MaterialsPanelProps {
	lessonId: string;
	materials: MaterialItem[];
	isLoading: boolean;
	error: string;
	onReload: () => void;
}

/** Khối học liệu nằm trong trình soạn bài — luôn thao tác trên bài học đã tồn tại. */
const MaterialsPanel = ({
	lessonId,
	materials,
	isLoading,
	error,
	onReload,
}: MaterialsPanelProps) => {
	const [title, setTitle] = useState('');
	// Trạng thái của tệp đang chờ: nhờ nó mà nút tải lên tự hiện spinner, không cần state riêng.
	const [pendingFile, setPendingFile] = useState<UploadFile | null>(null);

	useEffect(() => {
		// Đổi bài học thì bỏ tiêu đề còn dang dở của bài trước.
		setTitle('');
		setPendingFile(null);
	}, [lessonId]);

	const isUploading = pendingFile?.status === 'uploading';

	const handleUpload = async (file: File) => {
		setPendingFile({ uid: file.name, name: file.name, status: 'uploading' });
		try {
			const response = await uploadMaterial(
				lessonId,
				file,
				title.trim() || undefined,
			);
			message.success(response.message || 'Tải học liệu lên thành công');
			setTitle('');
			onReload();
		} catch (uploadError) {
			// Backend là nơi *thực thi* giới hạn dung lượng và danh sách định dạng cho phép
			// (`MAX_UPLOAD_SIZE_MB`); UI chỉ phản chiếu lại hai mã lỗi tài liệu hoá.
			const status = (uploadError as { response?: { status?: number } })
				.response?.status;

			if (status === 413) {
				message.error('Tệp vượt quá giới hạn dung lượng cho phép.');
			} else if (status === 415) {
				message.error('Định dạng tệp không được hỗ trợ.');
			} else {
				message.error(
					getApiErrorMessage(uploadError, 'Tải học liệu lên thất bại.'),
				);
			}
		} finally {
			// Xoá danh sách tệp để lần chọn sau (kể cả cùng tệp) vẫn kích hoạt upload.
			setPendingFile(null);
		}
	};

	const handleDelete = (material: MaterialItem) => {
		Modal.confirm({
			title: 'Xoá học liệu',
			content: `Bạn có chắc muốn xoá "${material.title}"? Tệp trên máy chủ cũng sẽ bị xoá.`,
			okText: 'Xoá',
			okButtonProps: { danger: true },
			cancelText: 'Huỷ bỏ',
			onOk: async () => {
				try {
					const response = await deleteMaterial(material.id);
					message.success(response.message || 'Đã xoá học liệu');
					onReload();
				} catch (deleteError) {
					message.error(
						getApiErrorMessage(deleteError, 'Xoá học liệu thất bại.'),
					);
				}
			},
		});
	};

	return (
		<section className="space-y-space-sm">
			<div className="flex flex-wrap items-center gap-space-sm">
				<h3 className="font-title-md font-title-md text-on-surface">
					Học liệu
				</h3>
				<Badge status="neutral" size="sm">
					{materials.length} tệp
				</Badge>
			</div>

			{error && (
				<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
					{error}
				</ErrorBadge>
			)}

			<div className="space-y-space-xs">
				{materials.map((material) => (
					<div
						key={material.id}
						className="flex flex-wrap items-center gap-space-sm rounded-lg border border-outline-variant bg-surface-container-lowest p-space-sm"
					>
						<Icon
							name={MATERIAL_ICON[material.materialType]}
							size={20}
							className="text-secondary"
						/>

						<div className="min-w-0 flex-1">
							<div className="truncate font-body-md font-body-md text-on-surface">
								{material.title}
							</div>
							<div className="flex flex-wrap items-center gap-space-xs">
								<Badge
									status={getMaterialTypeBadgeTone(material.materialType)}
									size="sm"
								>
									{MATERIAL_TYPE_LABEL[material.materialType]}
								</Badge>
								{material.fileSizeBytes !== null && (
									<span className="font-label-sm font-label-sm text-on-surface-variant">
										{formatFileSize(material.fileSizeBytes)}
									</span>
								)}
								{material.materialType === 'video' &&
									material.durationSeconds !== null && (
										<span className="font-label-sm font-label-sm text-on-surface-variant">
											{formatDuration(material.durationSeconds)}
										</span>
									)}
								{material.isPublished ? null : <UnpublishedBadge />}
							</div>
						</div>

						{material.url && (
							<a
								href={material.url}
								target="_blank"
								rel="noreferrer"
								className="font-label-lg font-label-lg text-secondary hover:underline"
							>
								Mở tệp
							</a>
						)}

						<IOutLinedBtn
							size="small"
							mode="error"
							onClick={() => handleDelete(material)}
						>
							Xoá
						</IOutLinedBtn>
					</div>
				))}

				{!materials.length && (
					<div className="rounded-lg border border-dashed border-outline-variant p-space-md text-center font-body-md font-body-md text-on-surface-variant">
						Bài học chưa có học liệu nào.
					</div>
				)}

				{isLoading && (
					<div className="flex justify-center py-space-sm">
						<Spin size="small" />
					</div>
				)}
			</div>

			<div className="space-y-space-xs rounded-lg border border-outline-variant bg-surface-container-low p-space-sm">
				<span className="font-label-md font-label-md text-on-surface-variant">
					Tiêu đề học liệu (không bắt buộc — bỏ trống thì lấy tên tệp)
				</span>

				<Input
					allowClear
					value={title}
					placeholder="Ví dụ: Slide bài giảng buổi 1"
					onChange={(event) => setTitle(event.target.value)}
				/>

				<Upload
					// `beforeUpload` trả `false` ⇒ antd KHÔNG tự gửi request; trang tự gọi
					// `uploadMaterial(id, file, title)` rồi xoá danh sách tệp để tránh thẻ "đang tải" treo.
					beforeUpload={(file) => {
						void handleUpload(file);
						return false;
					}}
					fileList={pendingFile ? [pendingFile] : []}
					maxCount={1}
					showUploadList={false}
				>
					<IOutLinedBtn
						mode="primary"
						icon={<UploadOutlined />}
						loading={isUploading}
						disabled={!lessonId}
					>
						Chọn tệp để tải lên
					</IOutLinedBtn>
				</Upload>

				<span className="font-label-sm font-label-sm text-on-surface-variant">
					Hệ thống tự kiểm tra dung lượng và định dạng tệp; tệp quá lớn hoặc sai
					định dạng sẽ bị từ chối.
				</span>
			</div>
		</section>
	);
};

interface LessonEditorProps {
	lessonId: string;
	/** Báo cho trang biết vừa lưu/xoá để tải lại mục lục. */
	onOutlineChanged: () => void;
	/** Báo cho trang biết form đang có thay đổi chưa lưu (để hỏi trước khi đổi bài). */
	onDirtyChange: (dirty: boolean) => void;
}

/** Cột phải: soạn nội dung một bài học (chi tiết + học liệu). */
const LessonEditor = ({
	lessonId,
	onOutlineChanged,
	onDirtyChange,
}: LessonEditorProps) => {
	const [form] = Form.useForm<LessonEditorFormValues>();
	const contentValue = Form.useWatch('content', form);

	const [lesson, setLesson] = useState<LessonDetail | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [isSaving, setIsSaving] = useState(false);
	/** Có thay đổi chưa lưu hay không — antd không re-render khi cờ "chạm" đổi, phải tự lắng nghe. */
	const [isDirty, setIsDirty] = useState(false);

	const [materials, setMaterials] = useState<MaterialItem[]>([]);
	const [isLoadingMaterials, setIsLoadingMaterials] = useState(false);
	const [materialsError, setMaterialsError] = useState('');
	const [materialsReloadKey, setMaterialsReloadKey] = useState(0);

	const applyLessonToForm = useCallback(
		(detail: LessonDetail) => {
			// `resetFields()` xoá cờ "đã chạm" trước khi nạp giá trị mới ⇒ form vừa tải xong (hoặc vừa
			// bấm "Hoàn tác") luôn được coi là **sạch**; nếu chỉ `setFieldsValue` thì cờ bẩn còn lại.
			form.resetFields();
			form.setFieldsValue({
				title: detail.title,
				summary: detail.summary ?? '',
				estimatedMinutes: detail.estimatedMinutes ?? null,
				dueAt: toDayjs(detail.dueAt),
				availableFrom: toDayjs(detail.availableFrom),
				isPublished: detail.isPublished,
				content: detail.content ?? '',
			});
			setIsDirty(false);
		},
		[form],
	);

	const loadLesson = useCallback(async () => {
		setIsLoading(true);
		setLoadError('');

		try {
			const response = await getLessonById(lessonId);
			const detail = response.data;
			if (!detail) throw new Error('Không tìm thấy bài học.');

			setLesson(detail);
			applyLessonToForm(detail);
		} catch (error) {
			setLesson(null);
			setLoadError(
				getApiErrorMessage(error, 'Không tải được nội dung bài học.'),
			);
		} finally {
			setIsLoading(false);
		}
	}, [lessonId, applyLessonToForm]);

	useEffect(() => {
		void loadLesson();
	}, [loadLesson]);

	// Cảnh báo "thay đổi chưa lưu" ở cột trái cần biết trạng thái này, và khi đổi bài thì component
	// bị tháo ra (key = lessonId) nên lúc dọn dẹp phải báo lại là "sạch".
	useEffect(() => {
		onDirtyChange(isDirty);
		return () => onDirtyChange(false);
	}, [isDirty, onDirtyChange]);

	const reloadMaterials = useCallback(
		() => setMaterialsReloadKey((value) => value + 1),
		[],
	);

	useEffect(() => {
		let cancelled = false;

		const load = async () => {
			setIsLoadingMaterials(true);
			setMaterialsError('');

			try {
				const response = await getMaterials(lessonId);
				if (cancelled) return;
				setMaterials(response.data?.items ?? []);
			} catch (error) {
				if (cancelled) return;
				setMaterials([]);
				setMaterialsError(
					getApiErrorMessage(error, 'Không tải được danh sách học liệu.'),
				);
			} finally {
				if (!cancelled) setIsLoadingMaterials(false);
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [lessonId, materialsReloadKey]);

	const handleSave = async (values: LessonEditorFormValues) => {
		if (!lesson) return;

		// Chỉ gửi trường đã đổi: `updateLesson` là PATCH nên gửi thừa làm mất tác dụng của việc
		// "chỉ ghi cái đã sửa", và dễ ghi đè thay đổi của người khác.
		const payload: UpdateLessonPayload = {};
		/** antd chỉ nhận tên trường đã khai báo; `keyof` của form khớp đúng tập đó. */
		const fieldTouched = (name: keyof LessonEditorFormValues) =>
			form.isFieldTouched(name as Parameters<typeof form.isFieldTouched>[0]);

		const nextTitle = values.title?.trim();
		if (nextTitle && nextTitle !== lesson.title) payload.title = nextTitle;

		const nextSummary = values.summary?.trim() || null;
		if (nextSummary !== lesson.summary) payload.summary = nextSummary;

		const nextEstimatedMinutes = values.estimatedMinutes ?? null;
		if (nextEstimatedMinutes !== lesson.estimatedMinutes) {
			payload.estimatedMinutes = nextEstimatedMinutes;
		}

		// Ngày gửi dạng ISO (`dayjs.toISOString()`). Xoá ô ngày phải gửi `null` — backend phân biệt
		// `null` ("xoá hạn") với `undefined` ("không đụng tới"), nên không được bỏ qua trường này.
		if (fieldTouched('dueAt')) {
			payload.dueAt = values.dueAt ? values.dueAt.toISOString() : null;
		}
		if (fieldTouched('availableFrom')) {
			payload.availableFrom = values.availableFrom
				? values.availableFrom.toISOString()
				: null;
		}

		if (
			fieldTouched('isPublished') &&
			values.isPublished !== lesson.isPublished
		) {
			payload.isPublished = !!values.isPublished;
		}

		// `content` là chuỗi HTML TipTap, cho phép rỗng (`''` ⇒ backend lưu NULL/rỗng).
		if (
			fieldTouched('content') &&
			(values.content ?? '') !== (lesson.content ?? '')
		) {
			payload.content = values.content ?? '';
		}

		if (!Object.keys(payload).length) {
			message.info('Không có thay đổi nào để lưu.');
			return;
		}

		setIsSaving(true);
		try {
			const response = await updateLesson(lesson.id, payload);
			message.success(response.message || 'Đã lưu bài học');
			onOutlineChanged();

			const detail = response.data;
			if (detail) {
				setLesson(detail);
				applyLessonToForm(detail);
			} else {
				await loadLesson();
			}
		} catch (error) {
			message.error(
				getApiErrorMessage(error, 'Lưu bài học thất bại, vui lòng thử lại.'),
			);
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md">
				<Skeleton active paragraph={{ rows: 8 }} />
			</div>
		);
	}

	if (loadError || !lesson) {
		return (
			<div className="space-y-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md">
				<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
					{loadError || 'Không tìm thấy bài học.'}
				</ErrorBadge>
				<IOutLinedBtn mode="primary" onClick={() => void loadLesson()}>
					Thử lại
				</IOutLinedBtn>
			</div>
		);
	}

	return (
		<div className="space-y-space-md">
			<div className="space-y-space-xs border-b border-outline-variant pb-space-sm">
				<div className="flex flex-wrap items-center gap-space-sm">
					<h2 className="font-headline-md font-headline-md text-on-surface">
						{lesson.title}
					</h2>
					<Badge status="info" size="sm">
						{LESSON_DERIVED_TYPE_LABEL[lesson.derivedType]}
					</Badge>
					{lesson.isPublished ? (
						<Badge status="success" size="sm" dot>
							Đã công bố
						</Badge>
					) : (
						<UnpublishedBadge />
					)}
				</div>
				<span className="font-label-sm font-label-sm text-on-surface-variant">
					Chương: {lesson.section.title} • /{lesson.slug}
				</span>
			</div>

			{isDirty && (
				<Alert
					type="warning"
					showIcon
					message="Bài học có thay đổi chưa lưu. Bấm “Lưu bài học” trước khi chuyển sang bài khác."
				/>
			)}

			<Form<LessonEditorFormValues>
				form={form}
				layout="vertical"
				className="space-y-space-sm"
				// Mọi thay đổi đều bật cảnh báo; `resetFields` trong `applyLessonToForm` tắt lại.
				onFieldsChange={() => setIsDirty(form.isFieldsTouched())}
				onFinish={handleSave}
			>
				<FormItem
					formItemProps={{ label: 'Tên bài học', name: 'title' }}
					rules={[{ required: true, message: 'Vui lòng nhập tên bài học.' }]}
				/>

				<FormItem
					formItemProps={{ label: 'Tóm tắt', name: 'summary' }}
					inputProps={{
						placeholder: 'Mô tả ngắn hiển thị ở danh sách bài học.',
					}}
				/>

				<div className="grid grid-cols-1 gap-space-sm md:grid-cols-3">
					<FormItem
						formItemProps={{
							label: 'Thời lượng dự kiến (phút)',
							name: 'estimatedMinutes',
						}}
					>
						<InputNumber
							className="w-full"
							size="large"
							min={0}
							max={6000}
							placeholder="45"
						/>
					</FormItem>

					<FormItem
						formItemProps={{ label: 'Mở từ', name: 'availableFrom' }}
						// `DatePicker` nhận/trả Dayjs; đổi sang ISO ngay trước khi gọi API.
						// Xoá trắng ô ⇒ `null` (không phải `undefined`) để backend biết là "xoá giá trị".
					>
						<DatePicker
							className="w-full"
							size="large"
							showTime
							format={DATE_TIME_FORMAT}
							placeholder="Chọn thời điểm mở"
						/>
					</FormItem>

					<FormItem formItemProps={{ label: 'Hạn hoàn thành', name: 'dueAt' }}>
						<DatePicker
							className="w-full"
							size="large"
							showTime
							format={DATE_TIME_FORMAT}
							placeholder="Chọn hạn hoàn thành"
						/>
					</FormItem>
				</div>

				<FormItem
					formItemProps={{
						label: 'Công bố bài học',
						name: 'isPublished',
						valuePropName: 'checked',
					}}
				>
					<Switch checkedChildren="Công bố" unCheckedChildren="Ẩn" />
				</FormItem>

				<FormItem
					formItemProps={{ label: 'Nội dung bài học', name: 'content' }}
				>
					{/* TipTap trả về chuỗi HTML; `Form.Item` bơm `value`/`onChange` xuống editor. */}
					<RichTextEditor
						placeholder="Soạn nội dung bài học (hỗ trợ tiêu đề, danh sách, liên kết, màu chữ...)"
						minHeight={360}
						value={contentValue ?? ''}
					/>
				</FormItem>

				<div className="flex flex-wrap items-center gap-space-sm">
					<ISolidBtn
						htmlType="submit"
						background="primary"
						loading={isSaving}
						icon={<Icon name="save" size={18} />}
					>
						Lưu bài học
					</ISolidBtn>
					<IOutLinedBtn
						onClick={() => applyLessonToForm(lesson)}
						disabled={isSaving}
					>
						Hoàn tác thay đổi
					</IOutLinedBtn>
				</div>
			</Form>

			<MaterialsPanel
				lessonId={lesson.id}
				materials={materials}
				isLoading={isLoadingMaterials}
				error={materialsError}
				onReload={reloadMaterials}
			/>
		</div>
	);
};

/** Mục lục bên trái: mỗi chương là một thẻ, kèm các bài học của nó. */
interface OutlinePaneProps {
	chapters: ChapterItem[];
	isLoading: boolean;
	loadError: string;
	selectedLessonId: string | null;
	onRetry: () => void;
	onAddChapter: () => void;
	onEditChapter: (section: SectionListItem) => void;
	onDeleteChapter: (section: SectionListItem) => void;
	onMoveChapter: (index: number, direction: -1 | 1) => void;
	onAddLesson: (section: SectionListItem) => void;
	onSelectLesson: (lesson: LessonListItem) => void;
	onTogglePublish: (lesson: LessonListItem) => void;
	onDeleteLesson: (lesson: LessonListItem) => void;
	onMoveLesson: (sectionId: string, index: number, direction: -1 | 1) => void;
	busyLessonId: string | null;
}

const OutlinePane = ({
	chapters,
	isLoading,
	loadError,
	selectedLessonId,
	onRetry,
	onAddChapter,
	onEditChapter,
	onDeleteChapter,
	onMoveChapter,
	onAddLesson,
	onSelectLesson,
	onTogglePublish,
	onDeleteLesson,
	onMoveLesson,
	busyLessonId,
}: OutlinePaneProps) => (
	<div className="space-y-space-sm rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
		<div className="flex flex-wrap items-center justify-between gap-space-sm">
			<h2 className="font-title-lg font-title-lg text-on-surface">
				Mục lục khoá học
			</h2>
			<ISolidBtn size="small" icon={<PlusOutlined />} onClick={onAddChapter}>
				Thêm chương
			</ISolidBtn>
		</div>

		{isLoading && (
			<div className="flex justify-center py-space-lg">
				<Spin tip="Đang tải mục lục..." />
			</div>
		)}

		{!isLoading && loadError && (
			<div className="space-y-space-sm">
				<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
					{loadError}
				</ErrorBadge>
				<IOutLinedBtn mode="primary" onClick={onRetry}>
					Thử lại
				</IOutLinedBtn>
			</div>
		)}

		{!isLoading && !loadError && !chapters.length && (
			<div className="rounded-lg border border-dashed border-outline-variant p-space-md text-center font-body-md font-body-md text-on-surface-variant">
				Khoá học chưa có chương nào. Bắt đầu bằng “Thêm chương”.
			</div>
		)}

		{!isLoading &&
			!loadError &&
			chapters.map((chapter, chapterIndex) => (
				<div
					key={chapter.section.id}
					className="space-y-space-xs rounded-lg border border-outline-variant bg-surface-container-low p-space-sm"
				>
					<div className="flex flex-wrap items-center gap-space-xs">
						<span className="font-label-md font-label-md text-on-surface-variant">
							Chương {chapterIndex + 1}
						</span>

						<Tooltip title="Di chuyển chương lên">
							<IconBtn
								size="small"
								icon={<ArrowUpOutlined />}
								disabled={chapterIndex === 0}
								onClick={() => onMoveChapter(chapterIndex, -1)}
							/>
						</Tooltip>
						<Tooltip title="Di chuyển chương xuống">
							<IconBtn
								size="small"
								icon={<ArrowDownOutlined />}
								disabled={chapterIndex === chapters.length - 1}
								onClick={() => onMoveChapter(chapterIndex, 1)}
							/>
						</Tooltip>

						<span className="min-w-0 flex-1 truncate font-title-md font-title-md text-on-surface">
							{chapter.section.title}
						</span>

						{chapter.section.isPublished ? null : <UnpublishedBadge />}

						<Badge status="neutral" size="sm">
							{chapter.lessons.length} bài
						</Badge>

						<Tooltip title="Sửa chương">
							<IconBtn
								size="small"
								icon={<Icon name="edit" size={18} />}
								onClick={() => onEditChapter(chapter.section)}
							/>
						</Tooltip>
						<Tooltip title="Xoá chương">
							<IconBtn
								size="small"
								danger
								icon={<DeleteOutlined />}
								onClick={() => onDeleteChapter(chapter.section)}
							/>
						</Tooltip>
					</div>

					{chapter.section.description && (
						<p className="font-label-sm font-label-sm text-on-surface-variant">
							{chapter.section.description}
						</p>
					)}

					<div className="space-y-space-xs">
						{chapter.lessons.map((lesson, lessonIndex) => {
							const isSelected = lesson.id === selectedLessonId;

							return (
								<div
									key={lesson.id}
									className={[
										'flex flex-wrap items-center gap-space-xs rounded-md border p-space-xs transition-colors',
										isSelected
											? 'border-secondary bg-surface-container'
											: 'border-outline-variant bg-surface-container-lowest',
									].join(' ')}
								>
									<Tooltip title="Đưa bài học lên">
										<IconBtn
											size="small"
											icon={<ArrowUpOutlined />}
											disabled={lessonIndex === 0}
											onClick={() =>
												onMoveLesson(chapter.section.id, lessonIndex, -1)
											}
										/>
									</Tooltip>
									<Tooltip title="Đưa bài học xuống">
										<IconBtn
											size="small"
											icon={<ArrowDownOutlined />}
											disabled={lessonIndex === chapter.lessons.length - 1}
											onClick={() =>
												onMoveLesson(chapter.section.id, lessonIndex, 1)
											}
										/>
									</Tooltip>

									<button
										type="button"
										className="min-w-0 flex-1 cursor-pointer text-left"
										onClick={() => onSelectLesson(lesson)}
									>
										<span className="block truncate font-body-md font-body-md text-on-surface">
											{lessonIndex + 1}. {lesson.title}
										</span>
										<span className="flex flex-wrap items-center gap-space-xs">
											<Badge status="info" size="sm">
												{LESSON_DERIVED_TYPE_LABEL[lesson.derivedType]}
											</Badge>
											{lesson.isPublished ? null : <UnpublishedBadge />}
											<span className="font-label-sm font-label-sm text-on-surface-variant">
												{lesson.materialCount} học liệu
												{lesson.estimatedMinutes !== null
													? ` • ${lesson.estimatedMinutes} phút`
													: ''}
											</span>
										</span>
									</button>

									<Tooltip
										title={
											lesson.isPublished ? 'Ẩn bài học' : 'Công bố bài học'
										}
									>
										<IconBtn
											size="small"
											loading={busyLessonId === lesson.id}
											icon={
												lesson.isPublished ? (
													<EyeInvisibleOutlined />
												) : (
													<Icon name="publish" size={18} />
												)
											}
											onClick={() => onTogglePublish(lesson)}
										/>
									</Tooltip>
									<Tooltip title="Xoá bài học">
										<IconBtn
											size="small"
											danger
											icon={<DeleteOutlined />}
											onClick={() => onDeleteLesson(lesson)}
										/>
									</Tooltip>
								</div>
							);
						})}

						{!chapter.lessons.length && (
							<p className="rounded-md border border-dashed border-outline-variant p-space-xs text-center font-label-sm font-label-sm text-on-surface-variant">
								Chương chưa có bài học.
							</p>
						)}

						<IOutLinedBtn
							size="small"
							icon={<PlusOutlined />}
							onClick={() => onAddLesson(chapter.section)}
						>
							Thêm bài học
						</IOutLinedBtn>
					</div>
				</div>
			))}
	</div>
);

interface CourseContentEditorProps {
	courseId: string;
}

/**
 * Trình soạn nội dung khoá học (E3-T9 phần 2).
 *
 * `courseId` do trang cha (E3-T8/E3-T9 phần 1 — `teacher/course-editor`) truyền xuống; component này
 * không đọc route để dùng lại được ở cả trang soạn thảo lẫn trang xem trước.
 */
export default function CourseContentEditor({
	courseId,
}: CourseContentEditorProps) {
	const [sections, setSections] = useState<SectionListItem[]>([]);
	const [lessons, setLessons] = useState<LessonListItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [reloadKey, setReloadKey] = useState(0);

	const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);
	const [busyLessonId, setBusyLessonId] = useState<string | null>(null);

	const [chapterModalOpen, setChapterModalOpen] = useState(false);
	const [editingChapter, setEditingChapter] = useState<SectionListItem | null>(
		null,
	);
	const [isSubmittingChapter, setIsSubmittingChapter] = useState(false);

	const [lessonModalSection, setLessonModalSection] =
		useState<SectionListItem | null>(null);
	const [isSubmittingLesson, setIsSubmittingLesson] = useState(false);

	/**
	 * Trạng thái "bẩn" của form bài học đang mở. Dùng `ref` (không phải state) vì chỉ cần đọc ngay
	 * trong sự kiện click chọn bài — lưu vào state sẽ re-render cả mục lục mỗi lần gõ một ký tự.
	 */
	const editorDirtyRef = useRef(false);

	/** Nạp lại mục lục sau mọi thao tác ghi — dùng chung cho cả hai cột. */
	const reloadOutline = useCallback(
		() => setReloadKey((value) => value + 1),
		[],
	);

	useEffect(() => {
		let cancelled = false;

		const load = async () => {
			setIsLoading(true);
			setLoadError('');

			try {
				// Hai endpoint tách rời (chương và bài học phẳng) rồi ghép ở client theo `sectionId`.
				const [sectionsResponse, lessonsResponse] = await Promise.all([
					getSections(courseId, { take: OUTLINE_TAKE }),
					getLessons(courseId, {
						take: OUTLINE_TAKE,
						sortBy: 'orderIndex',
						order: 'asc',
					}),
				]);

				if (cancelled) return;

				setSections(sortByOrderIndex(sectionsResponse.data?.items ?? []));
				setLessons(lessonsResponse.data?.items ?? []);
			} catch (error) {
				if (cancelled) return;

				setSections([]);
				setLessons([]);
				setLoadError(
					getApiErrorMessage(error, 'Không tải được mục lục khoá học.'),
				);
			} finally {
				if (!cancelled) setIsLoading(false);
			}
		};

		void load();

		return () => {
			cancelled = true;
		};
	}, [courseId, reloadKey]);

	const chapters = useMemo<ChapterItem[]>(() => {
		const lessonsBySection = groupLessonsBySection(lessons);

		return sortByOrderIndex(sections).map((section) => ({
			section,
			lessons: sortByOrderIndex(lessonsBySection[section.id] ?? []),
		}));
	}, [sections, lessons]);

	// ------------------------------------------------------------------ chương

	const openCreateChapter = () => {
		setEditingChapter(null);
		setChapterModalOpen(true);
	};

	const openEditChapter = (section: SectionListItem) => {
		setEditingChapter(section);
		setChapterModalOpen(true);
	};

	const handleSubmitChapter = async (values: ChapterFormValues) => {
		const payload = {
			title: values.title.trim(),
			description: values.description?.trim() || null,
			isPublished: values.isPublished ?? true,
		};

		setIsSubmittingChapter(true);
		try {
			if (editingChapter) {
				const response = await updateSection(editingChapter.id, payload);
				message.success(response.message || 'Đã cập nhật chương');
			} else {
				const response = await createSection(courseId, payload);
				message.success(response.message || 'Đã tạo chương');
			}

			setChapterModalOpen(false);
			setEditingChapter(null);
			reloadOutline();
		} catch (error) {
			// 400 (dữ liệu không hợp lệ) và 409 (trùng tên trong khoá) đều kèm câu tiếng Việt.
			message.error(
				getApiErrorMessage(error, 'Lưu chương thất bại, vui lòng thử lại.'),
			);
		} finally {
			setIsSubmittingChapter(false);
		}
	};

	const handleDeleteChapter = (section: SectionListItem) => {
		Modal.confirm({
			title: 'Xoá chương',
			content: `Bạn có chắc muốn xoá chương "${section.title}"? ${section.lessonCount} bài học bên trong cũng bị xoá theo.`,
			okText: 'Xoá chương',
			okButtonProps: { danger: true },
			cancelText: 'Huỷ bỏ',
			onOk: async () => {
				try {
					const response = await deleteSection(section.id);
					message.success(response.message || 'Đã xoá chương');
					// Bài đang chọn có thể nằm trong chương vừa xoá.
					if (lessons.some((lesson) => lesson.sectionId === section.id)) {
						setSelectedLessonId((current) => {
							const selected = lessons.find((lesson) => lesson.id === current);
							return selected?.sectionId === section.id ? null : current;
						});
					}
					reloadOutline();
				} catch (error) {
					// Backend trả 409 khi chương đã có bài nộp hoặc tiến độ học tập — hiện nguyên văn
					// thông báo đó thay vì câu chung chung.
					message.error(
						getApiErrorMessage(error, 'Xoá chương thất bại, vui lòng thử lại.'),
					);
				}
			},
		});
	};

	const handleMoveChapter = async (index: number, direction: -1 | 1) => {
		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= sections.length) return;

		try {
			// API yêu cầu danh sách ĐẦY ĐỦ, `orderIndex` liên tục từ 1 (không nhận "dịch một phần tử").
			const response = await reorderSections(
				courseId,
				buildSectionOrder(sections, index, targetIndex),
			);
			message.success(response.message || 'Đã cập nhật thứ tự chương');
			reloadOutline();
		} catch (error) {
			message.error(getApiErrorMessage(error, 'Đổi thứ tự chương thất bại.'));
		}
	};

	// ---------------------------------------------------------------- bài học

	const openCreateLesson = (section: SectionListItem) =>
		setLessonModalSection(section);

	const handleSubmitLesson = async (values: LessonFormValues) => {
		if (!lessonModalSection) return;

		const payload: CreateLessonPayload = {
			title: values.title.trim(),
			summary: values.summary?.trim() || null,
			estimatedMinutes: values.estimatedMinutes ?? null,
			isPublished: values.isPublished ?? false,
		};

		setIsSubmittingLesson(true);
		try {
			const response = await createLesson(lessonModalSection.id, payload);
			message.success(response.message || 'Đã tạo bài học');

			setLessonModalSection(null);
			reloadOutline();
			// Chọn ngay bài vừa tạo để giảng viên soạn nội dung luôn.
			if (response.data?.id) setSelectedLessonId(response.data.id);
		} catch (error) {
			message.error(
				getApiErrorMessage(error, 'Tạo bài học thất bại, vui lòng thử lại.'),
			);
		} finally {
			setIsSubmittingLesson(false);
		}
	};

	/** Chọn bài khác khi form đang bẩn thì phải xác nhận trước. */
	const handleSelectLesson = (lesson: LessonListItem) => {
		if (lesson.id === selectedLessonId) return;

		if (editorDirtyRef.current) {
			Modal.confirm({
				title: 'Bỏ thay đổi chưa lưu?',
				content:
					'Bài học đang mở có thay đổi chưa lưu. Chuyển sang bài khác sẽ bỏ các thay đổi đó.',
				okText: 'Bỏ thay đổi và chuyển',
				okButtonProps: { danger: true },
				cancelText: 'Ở lại bài này',
				onOk: () => setSelectedLessonId(lesson.id),
			});
			return;
		}

		setSelectedLessonId(lesson.id);
	};

	/** `LessonEditor` báo lên mỗi khi trạng thái "có thay đổi chưa lưu" đổi. */
	const handleEditorDirtyChange = useCallback((dirty: boolean) => {
		editorDirtyRef.current = dirty;
	}, []);

	const handleTogglePublish = async (lesson: LessonListItem) => {
		setBusyLessonId(lesson.id);
		try {
			// Dùng đúng endpoint publish/hide (chúng cập nhật `publishedAt` và phát thông báo),
			// không lật cờ `isPublished` qua `updateLesson`.
			const response = lesson.isPublished
				? await hideLesson(lesson.id)
				: await publishLesson(lesson.id);

			message.success(
				response.message ||
					(lesson.isPublished ? 'Đã ẩn bài học' : 'Đã công bố bài học'),
			);
			reloadOutline();
		} catch (error) {
			message.error(
				getApiErrorMessage(
					error,
					lesson.isPublished
						? 'Ẩn bài học thất bại.'
						: 'Công bố bài học thất bại.',
				),
			);
		} finally {
			setBusyLessonId(null);
		}
	};

	const handleDeleteLesson = (lesson: LessonListItem) => {
		Modal.confirm({
			title: 'Xoá bài học',
			content: `Bạn có chắc muốn xoá bài học "${lesson.title}"? Học liệu và nội dung của bài cũng bị xoá.`,
			okText: 'Xoá bài học',
			okButtonProps: { danger: true },
			cancelText: 'Huỷ bỏ',
			onOk: async () => {
				try {
					const response = await deleteLesson(lesson.id);
					message.success(response.message || 'Đã xoá bài học');
					if (selectedLessonId === lesson.id) setSelectedLessonId(null);
					reloadOutline();
				} catch (error) {
					// 409 khi bài đã có bài nộp hoặc tiến độ học tập.
					message.error(
						getApiErrorMessage(
							error,
							'Xoá bài học thất bại, vui lòng thử lại.',
						),
					);
				}
			},
		});
	};

	const handleMoveLesson = async (
		sectionId: string,
		index: number,
		direction: -1 | 1,
	) => {
		const chapter = chapters.find((item) => item.section.id === sectionId);
		if (!chapter) return;

		const targetIndex = index + direction;
		if (targetIndex < 0 || targetIndex >= chapter.lessons.length) return;

		try {
			const response = await reorderLessons(
				sectionId,
				buildLessonOrder(chapter.lessons, index, targetIndex),
			);
			message.success(response.message || 'Đã cập nhật thứ tự bài học');
			reloadOutline();
		} catch (error) {
			message.error(getApiErrorMessage(error, 'Đổi thứ tự bài học thất bại.'));
		}
	};

	const selectedLesson =
		lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;

	return (
		<div className="space-y-space-md p-gutter">
			<div className="flex flex-wrap items-center gap-space-sm">
				<h1 className="font-headline-lg font-headline-lg text-on-surface">
					Nội dung khoá học
				</h1>
				<Badge status="neutral" size="md">
					{sections.length} chương • {lessons.length} bài học
				</Badge>
			</div>

			{/* Màn hẹp: hai cột xếp chồng; từ `lg` trở lên mới tách hai panes. */}
			<div className="grid grid-cols-1 items-start gap-space-md lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
				<OutlinePane
					chapters={chapters}
					isLoading={isLoading}
					loadError={loadError}
					selectedLessonId={selectedLessonId}
					onRetry={reloadOutline}
					onAddChapter={openCreateChapter}
					onEditChapter={openEditChapter}
					onDeleteChapter={handleDeleteChapter}
					onMoveChapter={(index, direction) =>
						void handleMoveChapter(index, direction)
					}
					onAddLesson={openCreateLesson}
					onSelectLesson={handleSelectLesson}
					onTogglePublish={(lesson) => void handleTogglePublish(lesson)}
					onDeleteLesson={handleDeleteLesson}
					onMoveLesson={(sectionId, index, direction) =>
						void handleMoveLesson(sectionId, index, direction)
					}
					busyLessonId={busyLessonId}
				/>

				<div className="min-w-0 rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
					{selectedLesson ? (
						<LessonEditor
							key={selectedLesson.id}
							lessonId={selectedLesson.id}
							onOutlineChanged={reloadOutline}
							onDirtyChange={handleEditorDirtyChange}
						/>
					) : (
						<div className="flex min-h-[280px] flex-col items-center justify-center gap-space-sm text-center">
							<Icon name="edit_note" size={40} className="text-outline" />
							<p className="font-body-lg font-body-lg text-on-surface-variant">
								Chọn một bài học ở cột bên trái hoặc tạo bài mới.
							</p>
						</div>
					)}
				</div>
			</div>

			<ChapterFormModal
				open={chapterModalOpen}
				editing={editingChapter}
				isSubmitting={isSubmittingChapter}
				onCancel={() => {
					setChapterModalOpen(false);
					setEditingChapter(null);
				}}
				onSubmit={(values) => void handleSubmitChapter(values)}
			/>

			<LessonFormModal
				open={!!lessonModalSection}
				section={lessonModalSection}
				isSubmitting={isSubmittingLesson}
				onCancel={() => setLessonModalSection(null)}
				onSubmit={(values) => void handleSubmitLesson(values)}
			/>
		</div>
	);
}
