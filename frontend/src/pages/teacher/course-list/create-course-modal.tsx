import { useEffect, useState } from 'react';
import { Alert, Form, Input, Modal, Select, message } from 'antd';
import { getCategories } from '@/apis/category';
import { createCourse } from '@/apis/course';
import { getUsers } from '@/apis/user';
import {
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
	COURSE_VISIBILITY_LABEL,
	type Category,
	type CourseLevel,
	type CourseVisibility,
} from '@/types';

/**
 * Modal "Tạo khoá học" của trang `/teacher/courses` (E3-T9).
 *
 * Khoá mới **luôn** bắt đầu ở `draft` (backend tự đặt, không có trong payload) nên form chỉ thu
 * thập phần metadata tối thiểu để tạo bản ghi; phần còn lại sửa ở tab "Thông tin khoá học" của
 * trang soạn thảo.
 *
 * `categoryId` lấy từ `getCategories({ take: 100 })` — danh mục là dữ liệu ít đổi và nhỏ, nạp một
 * lần khi mở modal là đủ; không phân trang trong ô chọn.
 *
 * **`ownerId` là trường bắt buộc với `admin`** (`CourseService.resolveOwnerId`): `POST /api/courses`
 * trả `400` "Quản trị viên phải chỉ định giảng viên phụ trách khi tạo khoá học." khi admin bỏ
 * trống, vì `courses.owner_id` là `NOT NULL` và khoá học không thể thuộc về học viên. Với
 * `teacher` thì backend tự gán chủ sở hữu là chính họ và **bỏ qua** `ownerId`, nên trường này
 * không hiển thị và cũng không được gửi đi (gửi thừa chỉ là dữ liệu rác).
 *
 * Danh sách giảng viên lấy từ `getUsers({ role: 'teacher', take: 100 })`, nhưng **`GET /api/users`
 * chỉ admin gọi được** — nên nó chỉ được gọi khi `role === 'admin'`, và nếu gọi lỗi thì modal hiện
 * `ErrorBadge` + `Alert` và khoá nút "Tạo khoá học": im lặng để người dùng bấm rồi nhận `400` là
 * hành vi tệ hơn hẳn.
 */
export interface CreateCourseModalProps {
	open: boolean;
	onCancel: () => void;
	/**
	 * Gọi sau khi tạo thành công — trang cha đóng modal, nạp lại bảng và chuyển sang trang soạn
	 * thảo. `courseId` là `null` trong tình huống backend không trả `data.id`: khi đó trang cha
	 * chỉ nạp lại bảng thay vì điều hướng tới một URL rỗng.
	 */
	onCreated: (courseId: string | null) => void;
}

interface CreateCourseFormValues {
	code: string;
	title: string;
	summary?: string;
	categoryId?: string;
	semester?: string;
	level?: CourseLevel;
	visibility: CourseVisibility;
	enrollmentOpen?: boolean;
	/** Chỉ có mặt trong form khi người đang đăng nhập là `admin`. */
	ownerId?: string;
}

const DEFAULT_VISIBILITY: CourseVisibility = 'private';

const LEVEL_OPTIONS = (Object.keys(COURSE_LEVEL_LABEL) as CourseLevel[]).map(
	(level) => ({ value: level, label: COURSE_LEVEL_LABEL[level] }),
);

const VISIBILITY_OPTIONS = (
	Object.keys(COURSE_VISIBILITY_LABEL) as CourseVisibility[]
).map((visibility) => ({
	value: visibility,
	label: COURSE_VISIBILITY_LABEL[visibility],
}));

const CreateCourseModal = ({
	open,
	onCancel,
	onCreated,
}: CreateCourseModalProps) => {
	const [form] = Form.useForm<CreateCourseFormValues>();
	const currentUserRole = useAppSelector((state) => state.auth.user?.role);
	/** Chỉ `admin` mới phải chọn giảng viên phụ trách (và mới đọc được `GET /api/users`). */
	const isAdmin = currentUserRole === 'admin';

	const [categories, setCategories] = useState<Category[]>([]);
	const [isLoadingCategories, setIsLoadingCategories] = useState(false);
	const [teacherOptions, setTeacherOptions] = useState<
		{ value: string; label: string }[]
	>([]);
	const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
	const [teachersError, setTeachersError] = useState('');
	const [isSubmitting, setIsSubmitting] = useState(false);

	useEffect(() => {
		if (!open) return;

		// Mở lại modal sau lần tạo trước: xoá dữ liệu cũ để không vô tình gửi lại khoá vừa tạo.
		form.resetFields();
		form.setFieldsValue({ visibility: DEFAULT_VISIBILITY });

		let cancelled = false;

		const loadCategories = async () => {
			setIsLoadingCategories(true);
			try {
				const response = await getCategories({ take: 100, sortBy: 'name' });
				if (cancelled) return;
				setCategories(response.data?.items ?? []);
			} catch (error) {
				if (cancelled) return;
				// Danh mục là trường tuỳ chọn — không chặn việc tạo khoá, chỉ báo cho người dùng biết.
				message.error(
					getApiErrorMessage(error, 'Không tải được danh sách danh mục.'),
				);
				setCategories([]);
			} finally {
				if (!cancelled) setIsLoadingCategories(false);
			}
		};

		/**
		 * **Chỉ gọi khi là admin**: `GET /api/users` trả `403` cho mọi vai trò khác. Lỗi ở đây
		 * **không** được nuốt: nếu không có danh sách giảng viên thì admin không thể chọn `ownerId`,
		 * mà thiếu `ownerId` thì backend chắc chắn `400` — nên modal khoá nút submit và nói rõ lý do.
		 */
		const loadTeachers = async () => {
			if (!isAdmin) return;

			setIsLoadingTeachers(true);
			setTeachersError('');

			try {
				const response = await getUsers({ role: 'teacher', take: 100 });
				if (cancelled) return;

				setTeacherOptions(
					(response.data?.items ?? []).map((user) => ({
						value: user.id,
						label: `${user.fullName} (${user.email})`,
					})),
				);
			} catch (error) {
				if (cancelled) return;

				setTeacherOptions([]);
				setTeachersError(
					getApiErrorMessage(
						error,
						'Không tải được danh sách giảng viên, vui lòng thử lại.',
					),
				);
			} finally {
				if (!cancelled) setIsLoadingTeachers(false);
			}
		};

		void loadCategories();
		void loadTeachers();

		return () => {
			cancelled = true;
		};
	}, [open, form, isAdmin]);

	/** Admin không có danh sách giảng viên thì không thể điền `ownerId` — chặn ngay ở nút submit. */
	const isTeacherPickerBlocked =
		isAdmin && (!!teachersError || isLoadingTeachers);

	const handleSubmit = async (values: CreateCourseFormValues) => {
		setIsSubmitting(true);

		try {
			const response = await createCourse({
				code: values.code.trim(),
				title: values.title.trim(),
				summary: values.summary?.trim() || null,
				categoryId: values.categoryId || null,
				semester: values.semester?.trim() || null,
				level: values.level ?? null,
				visibility: values.visibility,
				// Chỉ admin gửi `ownerId`: với `teacher` backend bỏ qua trường này và lấy chính họ
				// làm chủ sở hữu, nên gửi kèm chỉ là dữ liệu rác.
				...(isAdmin && values.ownerId ? { ownerId: values.ownerId } : {}),
			});

			const createdId = response.data?.id;
			message.success(response.message || 'Tạo khoá học thành công');
			// Không có `data.id` thì không điều hướng được — trang cha nạp lại bảng và dừng ở đó.
			onCreated(createdId ?? null);
		} catch (error) {
			// 400 (validate, thiếu `ownerId`) và 409 (trùng `code`) đều kèm câu tiếng Việt — hiện nguyên văn.
			message.error(
				getApiErrorMessage(error, 'Tạo khoá học thất bại, vui lòng thử lại.'),
			);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Modal
			open={open}
			title="Tạo khoá học"
			footer={null}
			destroyOnHidden
			width={640}
			onCancel={onCancel}
		>
			<Form<CreateCourseFormValues>
				form={form}
				layout="vertical"
				requiredMark={false}
				initialValues={{ visibility: DEFAULT_VISIBILITY }}
				onFinish={handleSubmit}
				className="pt-space-sm"
			>
				<div className="grid grid-cols-1 gap-x-space-md md:grid-cols-2">
					<FormItem
						formItemProps={{ label: 'Mã môn', name: 'code' }}
						inputProps={{ placeholder: 'INT2204' }}
						rules={[
							{ required: true, message: 'Mã môn không được để trống' },
							{ max: 50, message: 'Mã môn tối đa 50 ký tự' },
						]}
					/>

					<FormItem
						formItemProps={{ label: 'Học kỳ', name: 'semester' }}
						inputProps={{ placeholder: 'HK1 2025-2026' }}
						rules={[{ max: 50, message: 'Học kỳ tối đa 50 ký tự' }]}
					/>
				</div>

				<FormItem
					formItemProps={{ label: 'Tên khoá học', name: 'title' }}
					inputProps={{ placeholder: 'Lập trình hướng đối tượng' }}
					rules={[
						{ required: true, message: 'Tên khoá học không được để trống' },
						{ max: 255, message: 'Tên khoá học tối đa 255 ký tự' },
					]}
				/>

				{isAdmin && (
					<>
						{teachersError && (
							<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
								{teachersError}
							</ErrorBadge>
						)}

						<FormItem
							formItemProps={{
								label: 'Giảng viên phụ trách',
								name: 'ownerId',
								extra:
									'Bắt buộc với quản trị viên: khoá học phải thuộc về một giảng viên. Chỉ hiển thị 100 giảng viên đầu tiên.',
							}}
							rules={[
								{
									required: true,
									message: 'Chọn giảng viên phụ trách cho khoá học',
								},
							]}
						>
							<Select
								showSearch
								size="large"
								placeholder="Chọn giảng viên phụ trách"
								loading={isLoadingTeachers}
								disabled={!!teachersError}
								optionFilterProp="label"
								options={teacherOptions}
								notFoundContent={
									isLoadingTeachers ? undefined : 'Không có giảng viên nào'
								}
							/>
						</FormItem>

						{teachersError && (
							<Alert
								type="error"
								showIcon
								message="Không tải được danh sách giảng viên nên chưa thể tạo khoá học. Hãy đóng hộp thoại và thử lại."
							/>
						)}
					</>
				)}

				<FormItem
					formItemProps={{ label: 'Mô tả ngắn', name: 'summary' }}
					rules={[{ max: 500, message: 'Mô tả ngắn tối đa 500 ký tự' }]}
				>
					<Input.TextArea
						rows={3}
						maxLength={500}
						showCount
						placeholder="Một hai câu giới thiệu nội dung khoá học…"
					/>
				</FormItem>

				<div className="grid grid-cols-1 gap-x-space-md md:grid-cols-2">
					<FormItem formItemProps={{ label: 'Danh mục', name: 'categoryId' }}>
						<Select
							allowClear
							size="large"
							loading={isLoadingCategories}
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
				</div>

				<FormItem
					formItemProps={{ label: 'Chế độ hiển thị', name: 'visibility' }}
				>
					<Select size="large" options={VISIBILITY_OPTIONS} />
				</FormItem>

				<p className="font-label-sm font-label-sm text-on-surface-variant">
					Khoá học mới luôn được tạo ở trạng thái “Bản nháp”. Sau khi thêm bài
					học, bạn công bố khoá ở trang soạn thảo.
				</p>

				<div className="mt-space-md flex justify-end gap-space-sm">
					<IOutLinedBtn onClick={onCancel}>Huỷ bỏ</IOutLinedBtn>
					<ISolidBtn
						type="primary"
						background="primary"
						htmlType="submit"
						loading={isSubmitting}
						disabled={isTeacherPickerBlocked}
					>
						Tạo khoá học
					</ISolidBtn>
				</div>
			</Form>
		</Modal>
	);
};

export default CreateCourseModal;
