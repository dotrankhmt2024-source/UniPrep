import { useEffect, useState } from 'react';
import { Alert, Input, Modal, Select, Space, Tag, message } from 'antd';
import { draftIntervention, sendIntervention } from '@/apis/analytics';
import { Icon, IOutLinedBtn } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import {
	INTERVENTION_ACTION_LABEL,
	type InterventionAction,
	type InterventionDraft,
	type LearnerRisk,
} from '@/types';

const ACTIONS: InterventionAction[] = [
	'in_app_message',
	'recommended_lesson',
	'mentor_assignment',
];

/**
 * Soạn → duyệt → gửi can thiệp. Bản nháp do backend soạn (LLM có kiểm tra số liệu, hoặc mẫu soạn sẵn);
 * giảng viên luôn được sửa trước khi gửi — không có gì tự gửi đi mà người dạy chưa đọc.
 */
const InterventionModal = ({
	courseId,
	learner,
	onClose,
	onSent,
}: {
	courseId: string;
	learner: LearnerRisk | null;
	onClose: () => void;
	onSent: () => void;
}) => {
	const [type, setType] = useState<InterventionAction>('in_app_message');
	const [draft, setDraft] = useState<InterventionDraft | null>(null);
	const [title, setTitle] = useState('');
	const [content, setContent] = useState('');
	const [drafting, setDrafting] = useState(false);
	const [sending, setSending] = useState(false);

	const makeDraft = async (action: InterventionAction) => {
		if (!learner) return;
		setDrafting(true);
		try {
			const res = await draftIntervention(courseId, {
				userId: learner.userId,
				type: action,
			});
			if (!res.data) return;
			setDraft(res.data);
			setTitle(res.data.title);
			setContent(res.data.content);
		} catch (error) {
			message.error(getApiErrorMessage(error));
		} finally {
			setDrafting(false);
		}
	};

	useEffect(() => {
		if (!learner) return;
		const initial =
			learner.suggestedAction && ACTIONS.includes(learner.suggestedAction)
				? learner.suggestedAction
				: 'in_app_message';
		setType(initial);
		setDraft(null);
		setTitle('');
		setContent('');
		void makeDraft(initial);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [learner?.userId]);

	const send = async () => {
		if (!learner) return;
		setSending(true);
		try {
			await sendIntervention(courseId, {
				userId: learner.userId,
				type,
				title,
				content,
				recommendedLessonIds: draft?.recommendedLessons.map(
					(lesson) => lesson.id,
				),
			});
			message.success(`Đã gửi can thiệp tới ${learner.fullName}`);
			onSent();
		} catch (error) {
			message.error(getApiErrorMessage(error));
		} finally {
			setSending(false);
		}
	};

	return (
		<Modal
			open={!!learner}
			onCancel={onClose}
			title={learner ? `Can thiệp: ${learner.fullName}` : ''}
			okText="Gửi cho học viên"
			cancelText="Huỷ"
			onOk={() => void send()}
			okButtonProps={{
				loading: sending,
				disabled: drafting || !title.trim() || content.trim().length < 10,
			}}
			width={640}
		>
			<div className="space-y-space-md">
				<Space wrap>
					<Select
						value={type}
						style={{ width: 240 }}
						disabled={drafting}
						onChange={(value) => {
							setType(value);
							void makeDraft(value);
						}}
						options={ACTIONS.map((action) => ({
							value: action,
							label: `${INTERVENTION_ACTION_LABEL[action]}${action === learner?.suggestedAction ? ' (ASP đề xuất)' : ''}`,
						}))}
					/>
					<IOutLinedBtn
						icon={<Icon name="refresh" size={16} />}
						loading={drafting}
						onClick={() => void makeDraft(type)}
					>
						Soạn lại
					</IOutLinedBtn>
					{draft && (
						<Tag color={draft.source === 'llm' ? 'green' : 'default'}>
							{draft.source === 'llm'
								? 'AI soạn · đã kiểm tra số liệu'
								: 'Mẫu soạn sẵn'}
						</Tag>
					)}
				</Space>
				{draft?.groundingIssues.length ? (
					<Alert
						type="info"
						showIcon
						message="Bản AI soạn có số liệu không khớp dữ liệu thật nên đã thay bằng mẫu soạn sẵn."
						description={draft.groundingIssues.join('; ')}
					/>
				) : null}
				<Input
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					maxLength={200}
					placeholder="Tiêu đề"
					disabled={drafting}
				/>
				<Input.TextArea
					value={content}
					onChange={(event) => setContent(event.target.value)}
					autoSize={{ minRows: 6, maxRows: 14 }}
					maxLength={2000}
					showCount
					placeholder="Nội dung"
					disabled={drafting}
				/>
				{draft?.recommendedLessons.length ? (
					<div className="text-body-sm text-on-surface-variant">
						Bài gợi ý đính kèm:{' '}
						{draft.recommendedLessons.map((lesson) => lesson.title).join(', ')}
					</div>
				) : null}
			</div>
		</Modal>
	);
};

export default InterventionModal;
