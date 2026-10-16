import { useCallback, useEffect, useMemo, useState } from 'react';
import { Select, Spin, message } from 'antd';
import { getCourses, setCoursePrerequisites } from '@/apis/course';
import { Badge, ErrorBadge, Icon, IOutLinedBtn, ISolidBtn } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import type { CourseListItem, PrerequisiteCourseRef } from '@/types';

/**
 * Tab "Điều kiện tiên quyết" của trang soạn thảo (E3-T9).
 *
 * **Payload là REPLACE, không phải append.** `PUT /api/courses/:id/prerequisites` nhận
 * `{ courseIds }` và thay **toàn bộ** danh sách tiên quyết bằng đúng mảng đó — khoá nào bị bỏ khỏi
 * mảng sẽ mất khỏi danh sách. Vì vậy `Select` được nạp sẵn các id hiện có và giá trị gửi lên luôn
 * là *toàn bộ* lựa chọn đang hiển thị, không phải phần vừa thêm.
 *
 * Ô chọn lấy từ `getCourses({ take: 100 })` và **loại trừ chính khoá đang sửa**: backend từ chối
 * một khoá là tiên quyết của chính nó (vòng lặp tự thân), và để nó trong danh sách chỉ tạo ra lỗi
 * 400 khó hiểu. Giới hạn 100 khoá là thoả hiệp có chủ ý — API chưa có endpoint "tìm khoá để chọn
 * tiên quyết" riêng, mà tải toàn bộ catalog vào một `Select` thì không dùng được.
 */
export interface CoursePrerequisitesTabProps {
	courseId: string;
	/** Danh sách tiên quyết hiện tại, lấy từ `getCourseById` của trang cha. */
	prerequisites: PrerequisiteCourseRef[];
	/** Gọi sau khi lưu để trang cha nạp lại chi tiết khoá học. */
	onChanged: () => void;
}

const CoursePrerequisitesTab = ({
	courseId,
	prerequisites,
	onChanged,
}: CoursePrerequisitesTabProps) => {
	const [selectedIds, setSelectedIds] = useState<string[]>(() =>
		prerequisites.map((item) => item.id),
	);
	const [options, setOptions] = useState<CourseListItem[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [loadError, setLoadError] = useState('');

	const loadOptions = useCallback(async () => {
		setIsLoading(true);
		setLoadError('');

		try {
			const response = await getCourses({
				take: 100,
				sortBy: 'code',
				order: 'asc',
			});
			setOptions(
				(response.data?.items ?? []).filter((course) => course.id !== courseId),
			);
		} catch (error) {
			setOptions([]);
			setLoadError(
				getApiErrorMessage(error, 'Không tải được danh sách khoá học.'),
			);
		} finally {
			setIsLoading(false);
		}
	}, [courseId]);

	useEffect(() => {
		void loadOptions();
	}, [loadOptions]);

	// Trang cha nạp lại chi tiết sau mỗi lần lưu ⇒ mảng `prerequisites` mới là nguồn chân lý,
	// đồng bộ lại lựa chọn đang hiển thị để không "dính" giá trị vừa gửi nếu backend chuẩn hoá khác.
	useEffect(() => {
		setSelectedIds(prerequisites.map((item) => item.id));
	}, [prerequisites]);

	const selectOptions = useMemo(
		() =>
			options.map((course) => ({
				value: course.id,
				label: `${course.code} — ${course.title}`,
			})),
		[options],
	);

	const savedIds = useMemo(
		() => prerequisites.map((item) => item.id),
		[prerequisites],
	);

	// So sánh theo tập hợp: `PUT` thay thế danh sách nên thứ tự không mang nghĩa, chỉ cần biết
	// lựa chọn hiện tại có khác bản đã lưu hay không.
	const hasChanges = useMemo(() => {
		const next = [...selectedIds].sort().join(',');
		const saved = [...savedIds].sort().join(',');

		return next !== saved;
	}, [selectedIds, savedIds]);

	const handleSave = async () => {
		setIsSaving(true);
		setLoadError('');

		try {
			// Gửi TOÀN BỘ danh sách đang chọn (thay thế), không phải phần chênh lệch.
			const response = await setCoursePrerequisites(courseId, {
				courseIds: selectedIds,
			});
			message.success(
				response.message || 'Cập nhật điều kiện tiên quyết thành công',
			);
			onChanged();
		} catch (error) {
			// 400 (tự tham chiếu / vòng lặp tiên quyết) kèm câu tiếng Việt của backend.
			setLoadError(
				getApiErrorMessage(
					error,
					'Cập nhật điều kiện tiên quyết thất bại, vui lòng thử lại.',
				),
			);
		} finally {
			setIsSaving(false);
		}
	};

	if (isLoading) {
		return (
			<div className="flex min-h-[30vh] items-center justify-center">
				<Spin size="large" />
			</div>
		);
	}

	return (
		<div className="max-w-3xl space-y-space-md">
			<div className="space-y-1">
				<h2 className="font-title-lg font-title-lg text-on-surface">
					Điều kiện tiên quyết
				</h2>
				<p className="font-body-sm font-body-sm text-on-surface-variant">
					Học viên phải hoàn thành các khoá dưới đây trước khi ghi danh. Lưu ý:
					danh sách gửi lên sẽ <strong>thay thế toàn bộ</strong> danh sách hiện
					có — khoá bạn bỏ chọn sẽ bị gỡ khỏi điều kiện tiên quyết.
				</p>
			</div>

			{loadError && (
				<div className="flex flex-wrap items-center gap-space-sm">
					<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
						{loadError}
					</ErrorBadge>
					<IOutLinedBtn size="small" onClick={() => void loadOptions()}>
						Thử lại
					</IOutLinedBtn>
				</div>
			)}

			<Select
				mode="multiple"
				allowClear
				size="large"
				className="w-full"
				placeholder="Chọn các khoá học phải hoàn thành trước"
				options={selectOptions}
				value={selectedIds}
				onChange={setSelectedIds}
				optionFilterProp="label"
				showSearch
			/>

			{prerequisites.length > 0 && (
				<div className="flex flex-wrap items-center gap-space-sm">
					<span className="font-label-sm font-label-sm text-on-surface-variant">
						Hiện có {prerequisites.length} điều kiện tiên quyết:
					</span>
					{prerequisites.map((item) => (
						<Badge
							key={item.id}
							status={item.isSatisfied ? 'success' : 'neutral'}
							dot
							title={
								item.isSatisfied
									? 'Bạn đã hoàn thành khoá này'
									: 'Bạn chưa hoàn thành khoá này'
							}
						>
							{item.code}
						</Badge>
					))}
				</div>
			)}

			<div className="flex justify-end gap-space-sm">
				<IOutLinedBtn
					disabled={!hasChanges || isSaving}
					onClick={() => setSelectedIds(savedIds)}
				>
					Hoàn tác
				</IOutLinedBtn>
				<ISolidBtn
					type="primary"
					background="primary"
					loading={isSaving}
					disabled={!hasChanges}
					onClick={() => void handleSave()}
				>
					Lưu điều kiện tiên quyết
				</ISolidBtn>
			</div>
		</div>
	);
};

export default CoursePrerequisitesTab;
