import { useEffect, useState } from 'react';
import { Button, Skeleton } from 'antd';
import { getQuizSubmissions } from '@/apis/assessment';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import { SUBMISSION_MODE_LABEL } from '@/types';
import type { AssessmentSubmission } from '@/types';

const STATUS_LABEL: Record<string, string> = {
	in_progress: 'Đang làm',
	submitted: 'Chờ chấm',
	graded: 'Đã chấm',
	expired: 'Hết giờ',
};

interface AttemptHistoryProps {
	quizId: string;
	/** Tăng sau mỗi lần nộp để danh sách tự tải lại mà không cần F5. */
	refreshKey: number;
	onViewResult: (submissionId: string) => void;
}

const formatDateTime = (value: string | null): string => {
	if (!value) return '—';
	const date = new Date(value);
	return Number.isNaN(date.getTime())
		? '—'
		: date.toLocaleString('vi-VN', {
				day: '2-digit',
				month: '2-digit',
				year: 'numeric',
				hour: '2-digit',
				minute: '2-digit',
			});
};

/**
 * Lịch sử làm bài của **chính học viên** cho một bài tập (yêu cầu 4.4 — "học viên xem kết quả và
 * lịch sử làm bài").
 *
 * Dùng `GET /api/submissions?quizId=…`: backend đã giới hạn học viên chỉ thấy bài nộp của mình
 * (`findSubmissions`), nên không cần lọc lại ở client — và cố tình không lọc, để không tạo cảm giác
 * an toàn giả bằng một điều kiện phía client.
 */
const AttemptHistory = ({
	quizId,
	refreshKey,
	onViewResult,
}: AttemptHistoryProps) => {
	const [items, setItems] = useState<AssessmentSubmission[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		let cancelled = false;
		const load = async () => {
			setLoading(true);
			setError('');
			try {
				const response = await getQuizSubmissions(quizId);
				if (!cancelled) setItems(response.data?.items ?? []);
			} catch (loadError) {
				if (!cancelled) {
					setError(
						getApiErrorMessage(loadError, 'Không tải được lịch sử làm bài.'),
					);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void load();
		return () => {
			cancelled = true;
		};
	}, [quizId, refreshKey]);

	if (loading) return <Skeleton active paragraph={{ rows: 2 }} />;

	if (error) {
		return <p className="font-body-sm text-red-700">{error}</p>;
	}

	if (items.length === 0) {
		return (
			<p className="font-body-sm text-on-surface-variant">
				Bạn chưa có lượt làm bài nào.
			</p>
		);
	}

	return (
		<ul className="space-y-space-xs">
			{items.map((item) => (
				<li
					key={item.id}
					className="flex flex-wrap items-center justify-between gap-space-sm border-b border-outline-variant pb-space-xs"
				>
					<span className="flex flex-col">
						<span className="font-body-md text-on-surface">
							Lượt {item.attemptNo} · {STATUS_LABEL[item.status] ?? item.status}
							{item.isLate ? ' · Nộp muộn' : ''}
						</span>
						<span className="font-body-sm text-on-surface-variant">
							{formatDateTime(item.submittedAt)}
							{' · '}
							{SUBMISSION_MODE_LABEL[item.submissionMode]}
							{item.fileCount > 0 ? ` · ${item.fileCount} tệp` : ''}
						</span>
					</span>
					<span className="flex items-center gap-space-sm">
						<span className="font-title-md text-primary">
							{item.score === null
								? 'Chưa có điểm'
								: `${item.score}/${item.maxScore ?? '—'}`}
						</span>
						<Button size="small" onClick={() => onViewResult(item.id)}>
							Xem kết quả
						</Button>
					</span>
				</li>
			))}
		</ul>
	);
};

export default AttemptHistory;
