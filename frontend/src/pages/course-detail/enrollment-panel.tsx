import type { ReactNode } from 'react';
import { Badge, ErrorBadge, Icon, ISolidBtn } from '@/components';
import { ENROLLMENT_STATUS_LABEL, type CourseDetail } from '@/types';
import { getEnrollmentStatusBadgeTone } from '@/utils/course';

/**
 * Khối "Ghi danh" ở cột phải trang chi tiết khoá học (E3-T7).
 *
 * Bốn trạng thái, theo đúng thứ tự ưu tiên:
 * 1. `myEnrollment !== null` — đã ghi danh: hiện nhãn trạng thái ghi danh + nút "Vào học".
 * 2. `isStaff` (`role !== 'student'`) — giảng viên/admin **không bao giờ** thấy nút đăng ký.
 * 3. `eligibility.eligible === false` — thiếu tiên quyết: nút đăng ký bị khoá kèm lý do.
 * 4. Còn lại (học viên đủ điều kiện, hoặc `eligibility === null`) — nút đăng ký thật.
 *
 * **Vì sao `isStaff` chứ không phải "có phải chủ sở hữu không":** API không trả cờ "người gọi
 * quản lý được khoá này", mà chỉ trả `owner` + `instructors`. Giảng viên vẫn xem được khoá
 * draft/hidden của người khác trong một số trường hợp, nên suy diễn "không phải chủ sở hữu ⇒ hiện
 * nút đăng ký" sẽ tạo ra nút đăng ký cho người không bao giờ dùng tới (và backend đã chặn ghi danh
 * cho khoá chưa publish). Quy tắc đơn giản và luôn đúng: `role !== 'student'` ⇒ chỉ có "Vào học".
 * `canManage` chỉ dùng để chọn **câu giải thích** cho đúng ngữ cảnh, không dùng để hiện/ẩn nút.
 */
interface CourseEnrollmentPanelProps {
	course: CourseDetail;
	/** `role !== 'student'`. */
	isStaff: boolean;
	/** Chủ sở hữu / được phân công / admin — chỉ để chọn lời giải thích. */
	canManage: boolean;
	isEnrolling: boolean;
	onEnroll: () => void;
	onGoToLearn: () => void;
}

const CourseEnrollmentPanel = ({
	course,
	isStaff,
	canManage,
	isEnrolling,
	onEnroll,
	onGoToLearn,
}: CourseEnrollmentPanelProps) => {
	const { myEnrollment, eligibility } = course;

	let body: ReactNode;

	if (myEnrollment) {
		body = (
			<>
				<div className="flex flex-wrap items-center justify-between gap-space-sm">
					<span className="font-label-md font-label-md text-on-surface-variant">
						Trạng thái ghi danh
					</span>
					<Badge status={getEnrollmentStatusBadgeTone(myEnrollment.status)} dot>
						{ENROLLMENT_STATUS_LABEL[myEnrollment.status]}
					</Badge>
				</div>
				<p className="font-body-sm font-body-sm text-on-surface-variant">
					Bạn đã đăng ký khoá học này.
				</p>
				<ISolidBtn
					type="primary"
					background="primary"
					block
					icon={<Icon name="play_circle" size={16} />}
					onClick={onGoToLearn}
				>
					Vào học
				</ISolidBtn>
			</>
		);
	} else if (isStaff) {
		body = (
			<>
				<p className="font-body-sm font-body-sm text-on-surface-variant">
					{canManage
						? 'Bạn phụ trách khoá học này.'
						: 'Bạn là giảng viên hoặc quản trị viên nên không cần đăng ký khoá học này.'}
				</p>
				<ISolidBtn
					type="primary"
					background="primary"
					block
					icon={<Icon name="play_circle" size={16} />}
					onClick={onGoToLearn}
				>
					Vào học
				</ISolidBtn>
			</>
		);
	} else if (eligibility && !eligibility.eligible) {
		body = (
			<>
				<ErrorBadge icon={<Icon name="error" size={14} />} size="md">
					{eligibility.reason ?? 'Bạn chưa đủ điều kiện đăng ký khoá học này.'}
				</ErrorBadge>
				<ISolidBtn
					type="primary"
					background="primary"
					block
					disabled
					title="Hoàn thành các khoá học tiên quyết trước khi đăng ký"
				>
					Đăng ký khoá học
				</ISolidBtn>
				<p className="font-body-sm font-body-sm text-on-surface-variant">
					Nút đăng ký được mở lại khi bạn hoàn thành đủ các khoá học tiên quyết
					ở trên.
				</p>
			</>
		);
	} else {
		body = (
			<>
				<p className="font-body-sm font-body-sm text-on-surface-variant">
					Bạn chưa đăng ký khoá học này.
				</p>
				<ISolidBtn
					type="primary"
					background="primary"
					block
					icon={<Icon name="app_registration" size={16} />}
					// `loading` + `disabled`: chặn gửi hai lần khi request còn bay (backend trả 409).
					loading={isEnrolling}
					disabled={isEnrolling}
					onClick={onEnroll}
				>
					Đăng ký khoá học
				</ISolidBtn>
			</>
		);
	}

	return (
		<section className="space-y-space-md rounded-xl border border-outline-variant bg-surface-container-lowest p-space-md shadow-sm">
			<h2 className="font-title-md font-title-md font-semibold text-on-surface">
				Ghi danh
			</h2>
			{body}
		</section>
	);
};

export default CourseEnrollmentPanel;
