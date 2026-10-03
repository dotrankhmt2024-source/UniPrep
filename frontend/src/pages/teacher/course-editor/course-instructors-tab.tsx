import { useCallback, useEffect, useState } from 'react';
import {
	Alert,
	Form,
	Modal,
	Select,
	Tooltip,
	message,
	type TableProps,
} from 'antd';
import dayjs from 'dayjs';
import {
	assignInstructor,
	getCohorts,
	getCourseInstructors,
	removeInstructor,
} from '@/apis/course';
import { getUsers } from '@/apis/user';
import {
	Badge,
	ErrorBadge,
	FormItem,
	Icon,
	IOutLinedBtn,
	ISolidBtn,
	ITable,
} from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import { useAppSelector } from '@/store/hooks';
import {
	COURSE_INSTRUCTOR_ROLE_LABEL,
	type CohortItem,
	type CourseInstructorItem,
	type CourseInstructorRole,
} from '@/types';

/**
 * Tab "Giảng viên phụ trách" của trang soạn thảo (E3-T9).
 *
 * **Giới hạn thật của API hiện tại — `GET /api/users` chỉ admin gọi được.** Ô chọn giảng viên vì
 * vậy có hai chế độ:
 * - `admin`: nạp `getUsers({ role: 'teacher', take: 100 })` và cho chọn từ danh sách (có tên/email).
 * - `teacher`: **không** gọi `/users` (sẽ nhận `403`), thay vào đó là một ô `Input` để dán UUID.
 *   Đây là thoả hiệp tạm thời; khi backend có endpoint tra cứu giảng viên cho mọi vai trò thì chỉ
 *   cần thay nhánh này, phần còn lại của tab không đổi.
 *
 * Hàng của **chủ sở hữu** không gỡ được: `DELETE /api/courses/:id/instructors/:userId` trả `400`
 * cho chủ sở hữu (đổi chủ là thao tác quản trị qua `PATCH /courses/:id` với `ownerId`). Nút bị vô
 * hiệu hoá kèm tooltip giải thích thay vì để người dùng bấm rồi nhận lỗi.
 */
export interface CourseInstructorsTabProps {
	courseId: string;
	/** Gọi sau mỗi lần ghi để trang cha nạp lại chi tiết khoá học. */
	onChanged: () => void;
}

interface AssignFormValues {
	userId: string;
	roleInCourse: CourseInstructorRole;
	cohortId?: string | null;
}

const DEFAULT_ROLE: CourseInstructorRole = 'co_instructor';

const ROLE_OPTIONS = (
	Object.keys(COURSE_INSTRUCTOR_ROLE_LABEL) as CourseInstructorRole[]
).map((role) => ({ value: role, label: COURSE_INSTRUCTOR_ROLE_LABEL[role] }));

const CourseInstructorsTab = ({
	courseId,
	onChanged,
}: CourseInstructorsTabProps) => {
	const currentUserRole = useAppSelector((state) => state.auth.user?.role);
	const isAdmin = currentUserRole === 'admin';

	const [assignForm] = Form.useForm<AssignFormValues>();

	const [rows, setRows] = useState<CourseInstructorItem[]>([]);
	const [cohorts, setCohorts] = useState<CohortItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState('');
	const [reloadKey, setReloadKey] = useState(0);
	const [removingUserId, setRemovingUserId] = useState<string | null>(null);

	const [isAssignOpen, setIsAssignOpen] = useState(false);
	const [teacherOptions, setTeacherOptions] = useState<
		{ value: string; label: string }[]
	>([]);
	const [isLoadingTeachers, setIsLoadingTeachers] = useState(false);
	const [isAssigning, setIsAssigning] = useState(false);
	const [assignError, setAssignError] = useState('');

	const reload = () => setReloadKey((value) => value + 1);

	const load = useCallback(async () => {
		setIsLoading(true);
		setLoadError('');

		try {
			// Hai request độc lập: danh sách phân công và danh sách lớp (lớp còn dùng cho ô chọn
			// "phạm vi lớp" khi phân công). `Promise.all` để không chờ tuần tự.
			const [instructorResponse, cohortResponse] = await Promise.all([
				getCourseInstructors(courseId),
				getCohorts(courseId),
			]);

			setRows(instructorResponse.data?.items ?? []);
			setCohorts(cohortResponse.data?.items ?? []);
		} catch (error) {
			setRows([]);
			setCohorts([]);
			setLoadError(
				getApiErrorMessage(error, 'Không tải được danh sách giảng viên.'),
			);
		} finally {
			setIsLoading(false);
		}
	}, [courseId]);

	useEffect(() => {
		void load();
	}, [load, reloadKey]);

	/**
	 * Nạp danh sách giảng viên cho ô chọn — **chỉ khi là admin**, vì `GET /api/users` trả `403` cho
	 * mọi vai trò khác. Kết quả được giữ lại giữa các lần mở modal (tối đa 100 giảng viên).
	 */
	const loadTeachers = useCallback(async () => {
		setIsLoadingTeachers(true);
		try {
			const response = await getUsers({ role: 'teacher', take: 100 });
			setTeacherOptions(
				(response.data?.items ?? []).map((user) => ({
					value: user.id,
					label: `${user.fullName} (${user.email})`,
				})),
			);
		} catch (error) {
			message.error(
				getApiErrorMessage(error, 'Không tải được danh sách giảng viên.'),
			);
		} finally {
			setIsLoadingTeachers(false);
		}
	}, []);

	/**
	 * `Form.useForm()` cần một `<Form>` đã mount mới nhận `setFieldsValue`. Vì modal dùng
	 * `destroyOnHidden`, form chỉ tồn tại khi modal mở ⇒ nạp giá trị mặc định trong `useEffect`
	 * theo `isAssignOpen` thay vì ngay trong hàm mở modal (sẽ bị antd cảnh báo "Instance created by
	 * `useForm` is not connected to any Form element").
	 */
	useEffect(() => {
		if (!isAssignOpen) return;
		assignForm.resetFields();
		assignForm.setFieldsValue({ roleInCourse: DEFAULT_ROLE, cohortId: null });
	}, [isAssignOpen, assignForm]);

	const openAssignModal = () => {
		setAssignError('');
		setIsAssignOpen(true);

		if (isAdmin && teacherOptions.length === 0 && !isLoadingTeachers) {
			void loadTeachers();
		}
	};

	const handleAssign = async () => {
		let values: AssignFormValues;

		try {
			values = await assignForm.validateFields();
		} catch {
			// `validateFields` reject khi còn lỗi hiển thị ngay dưới ô nhập — không cần thêm gì.
			return;
		}

		setIsAssigning(true);
		setAssignError('');

		try {
			const response = await assignInstructor(courseId, {
				userId: values.userId.trim(),
				roleInCourse: values.roleInCourse,
				// `null` = phụ trách cả khoá (không gắn với lớp nào).
				cohortId: values.cohortId || null,
			});
			message.success(response.message || 'Phân công giảng viên thành công');
			setIsAssignOpen(false);
			reload();
			onChanged();
		} catch (error) {
			// 404 (không phải giảng viên / lớp không thuộc khoá) và 409 (đã phân công) kèm câu tiếng Việt.
			setAssignError(
				getApiErrorMessage(
					error,
					'Phân công giảng viên thất bại, vui lòng thử lại.',
				),
			);
		} finally {
			setIsAssigning(false);
		}
	};

	const handleRemove = (record: CourseInstructorItem) => {
		Modal.confirm({
			title: 'Gỡ phân công giảng viên',
			content: `Gỡ ${record.fullName} (${record.email}) khỏi khoá học này?`,
			okText: 'Gỡ phân công',
			cancelText: 'Huỷ bỏ',
			okButtonProps: { danger: true },
			onOk: async () => {
				setRemovingUserId(record.userId);
				try {
					const response = await removeInstructor(courseId, record.userId);
					message.success(response.message || 'Đã gỡ phân công giảng viên');
					reload();
					onChanged();
				} catch (error) {
					// 400 khi gỡ chủ sở hữu (nút đã bị vô hiệu hoá, đây là lưới an toàn).
					message.error(
						getApiErrorMessage(
							error,
							'Gỡ phân công giảng viên thất bại, vui lòng thử lại.',
						),
					);
				} finally {
					setRemovingUserId(null);
				}
			},
		});
	};

	const columns: TableProps<CourseInstructorItem>['columns'] = [
		{
			title: 'Giảng viên',
			dataIndex: 'fullName',
			key: 'fullName',
			render: (value: string, record) => (
				<div className="space-y-1">
					<div className="font-semibold text-on-surface">{value || '—'}</div>
					<div className="font-label-sm font-label-sm text-on-surface-variant">
						{record.email || '—'}
					</div>
				</div>
			),
		},
		{
			title: 'Vai trò',
			dataIndex: 'roleInCourse',
			key: 'roleInCourse',
			width: 170,
			render: (value: CourseInstructorRole) => (
				<Badge status={value === 'owner' ? 'success' : 'info'} dot>
					{COURSE_INSTRUCTOR_ROLE_LABEL[value]}
				</Badge>
			),
		},
		{
			title: 'Phạm vi',
			dataIndex: 'cohortName',
			key: 'cohortName',
			width: 200,
			render: (value: string | null) => (
				<span className="text-on-surface-variant">{value ?? 'Cả khoá'}</span>
			),
		},
		{
			title: 'Ngày phân công',
			dataIndex: 'assignedAt',
			key: 'assignedAt',
			width: 160,
			render: (value: string) => dayjs(value).format('DD/MM/YYYY HH:mm'),
		},
		{
			title: 'Thao tác',
			key: 'actions',
			width: 110,
			align: 'right',
			render: (_value, record) => {
				// Backend trả `400` khi gỡ chủ sở hữu: đổi chủ phải qua `PATCH /courses/:id`.
				const isOwnerRow = record.roleInCourse === 'owner';

				return (
					<Tooltip
						title={
							isOwnerRow
								? 'Không thể gỡ chủ sở hữu khoá học. Hãy đổi giảng viên phụ trách ở tab "Thông tin khoá học".'
								: undefined
						}
					>
						{/* Bọc trong `span` vì nút `disabled` không phát sự kiện chuột cho Tooltip. */}
						<span className="inline-flex">
							<IOutLinedBtn
								size="small"
								mode="error"
								disabled={isOwnerRow}
								loading={removingUserId === record.userId}
								onClick={() => handleRemove(record)}
							>
								Gỡ
							</IOutLinedBtn>
						</span>
					</Tooltip>
				);
			},
		},
	];

	return (
		<div className="space-y-space-md">
			<div className="flex flex-wrap items-center justify-between gap-space-sm">
				<div className="space-y-1">
					<h2 className="font-title-lg font-title-lg text-on-surface">
						Giảng viên phụ trách
					</h2>
					<p className="font-body-sm font-body-sm text-on-surface-variant">
						Phân công đồng giảng viên hoặc trợ giảng cho cả khoá, hoặc giới hạn
						trong một lớp cụ thể.
					</p>
				</div>

				<ISolidBtn
					type="primary"
					background="primary"
					icon={<Icon name="person_add" size={18} />}
					onClick={openAssignModal}
				>
					Phân công giảng viên
				</ISolidBtn>
			</div>

			{loadError && (
				<div className="flex flex-wrap items-center gap-space-sm">
					<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
						{loadError}
					</ErrorBadge>
					<IOutLinedBtn size="small" onClick={reload}>
						Thử lại
					</IOutLinedBtn>
				</div>
			)}

			<div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
				<ITable<CourseInstructorItem>
					columns={columns}
					dataSource={rows}
					rowKey="id"
					loading={isLoading}
					pagination={false}
				/>
			</div>

			<Modal
				open={isAssignOpen}
				title="Phân công giảng viên"
				footer={null}
				destroyOnHidden
				onCancel={() => setIsAssignOpen(false)}
			>
				<Form<AssignFormValues>
					form={assignForm}
					layout="vertical"
					requiredMark={false}
					initialValues={{ roleInCourse: DEFAULT_ROLE, cohortId: null }}
					className="space-y-space-md pt-space-sm"
				>
					{assignError && (
						<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
							{assignError}
						</ErrorBadge>
					)}

					{isAdmin ? (
						<FormItem
							formItemProps={{
								label: 'Giảng viên',
								name: 'userId',
								extra: 'Danh sách giới hạn 100 giảng viên đầu tiên.',
							}}
							rules={[
								{ required: true, message: 'Chọn giảng viên cần phân công' },
							]}
						>
							<Select
								showSearch
								size="large"
								placeholder="Chọn giảng viên"
								loading={isLoadingTeachers}
								optionFilterProp="label"
								options={teacherOptions}
							/>
						</FormItem>
					) : (
						<FormItem
							formItemProps={{
								label: 'Giảng viên',
								name: 'userId',
								extra:
									'Dán mã người dùng (UUID) của giảng viên — danh sách người dùng chỉ quản trị viên xem được.',
							}}
							inputProps={{
								placeholder: 'd290f1ee-6c54-4b01-90e6-d701748f0851',
							}}
							rules={[
								{
									required: true,
									message: 'Dán mã người dùng (UUID) của giảng viên',
								},
								{
									pattern:
										/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
									message: 'Mã người dùng phải là UUID v4 hợp lệ',
								},
							]}
						/>
					)}

					<FormItem
						formItemProps={{
							label: 'Vai trò trong khoá',
							name: 'roleInCourse',
						}}
					>
						<Select size="large" options={ROLE_OPTIONS} />
					</FormItem>

					<FormItem
						formItemProps={{
							label: 'Lớp phụ trách',
							name: 'cohortId',
							extra: 'Để trống nghĩa là phụ trách cả khoá.',
						}}
					>
						<Select
							allowClear
							size="large"
							placeholder="Cả khoá"
							options={cohorts.map((cohort) => ({
								value: cohort.id,
								label: cohort.classCode
									? `${cohort.classCode} — ${cohort.name}`
									: cohort.name,
							}))}
						/>
					</FormItem>

					{!isAdmin && (
						<Alert
							type="info"
							showIcon
							message="Danh sách người dùng chỉ quản trị viên xem được, nên bạn cần dán UUID của giảng viên."
						/>
					)}

					<div className="flex justify-end gap-space-sm">
						<IOutLinedBtn onClick={() => setIsAssignOpen(false)}>
							Huỷ bỏ
						</IOutLinedBtn>
						<ISolidBtn
							type="primary"
							background="primary"
							loading={isAssigning}
							onClick={() => void handleAssign()}
						>
							Phân công
						</ISolidBtn>
					</div>
				</Form>
			</Modal>
		</div>
	);
};

export default CourseInstructorsTab;
