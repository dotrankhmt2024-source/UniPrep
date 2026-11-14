import { Alert, Space, Tag, Typography } from 'antd';
import { Link } from 'react-router';
import { Icon, IOutLinedBtn, ProseContent } from '@/components';
import type { TutorAnswer, TutorCitation } from '@/types';

const { Text } = Typography;

const anchor = (stepId: string, index: number) => `cite-${stepId}-${index}`;

/**
 * `[1]` trong câu trả lời → link nhảy tới thẻ trích dẫn bên dưới. Chỉ đổi số có thật trong
 * `citations` và bỏ qua `[n](...)` (đã là link markdown).
 */
const linkCitations = (message: string, stepId: string, count: number) =>
	message.replace(/\[(\d{1,2})\](?!\()/g, (match, raw: string) => {
		const index = Number(raw);
		return index >= 1 && index <= count
			? `[[${index}]](#${anchor(stepId, index)})`
			: match;
	});

const Citation = ({
	citation,
	stepId,
	courseId,
}: {
	citation: TutorCitation;
	stepId: string;
	courseId: string;
}) => (
	<div id={anchor(stepId, citation.index)} className="tutor-citation">
		<div className="tutor-citation-head">
			<span>
				<Text strong>[{citation.index}]</Text>{' '}
				<Text>
					Bài {citation.lessonKey} · {citation.lessonTitle}
				</Text>
				{citation.heading && (
					<Text type="secondary"> › {citation.heading}</Text>
				)}
			</span>
			<Space size={4}>
				<Link to={`/courses/${courseId}/learn/${citation.lessonId}`}>
					<IOutLinedBtn size="small" icon={<Icon name="menu_book" size={14} />}>
						Mở bài học
					</IOutLinedBtn>
				</Link>
				{citation.sourceUrl && (
					<a
						href={citation.sourceUrl}
						target="_blank"
						rel="noopener noreferrer"
					>
						<IOutLinedBtn
							size="small"
							icon={<Icon name="open_in_new" size={14} />}
						>
							Nguồn gốc
						</IOutLinedBtn>
					</a>
				)}
			</Space>
		</div>
		<div className="tutor-citation-excerpt">{citation.excerpt}</div>
	</div>
);

export const AnswerView = ({
	answer,
	stepId,
	courseId,
	interactive,
	onAsk,
}: {
	answer: TutorAnswer;
	stepId: string;
	courseId: string;
	/** Chỉ câu trả lời mới nhất (khi AI không bận) mới cho bấm gợi ý. */
	interactive: boolean;
	onAsk: (question: string) => void;
}) => (
	<div className="tutor-answer">
		<ProseContent
			size="sm"
			format="markdown"
			content={linkCitations(answer.message, stepId, answer.citations.length)}
		/>
		{answer.citations.length > 0 ? (
			<div className="tutor-citations">
				<Text type="secondary" style={{ fontSize: 12 }}>
					<Tag color="green" style={{ marginRight: 6 }}>
						Có căn cứ
					</Tag>
					{answer.citations.length} đoạn trích từ học liệu của khoá học
				</Text>
				{answer.citations.map((citation) => (
					<Citation
						key={citation.chunkId}
						citation={citation}
						stepId={stepId}
						courseId={courseId}
					/>
				))}
			</div>
		) : (
			!answer.grounded && (
				<Alert
					type="warning"
					showIcon
					message="Không tìm thấy căn cứ trong học liệu của khoá học. Hãy kiểm tra lại với giảng viên hoặc tài liệu chính thức."
				/>
			)
		)}
		{answer.suggestions.length > 0 && interactive && (
			<Space size={[6, 6]} wrap>
				{answer.suggestions.map((question) => (
					<IOutLinedBtn
						key={question}
						size="small"
						onClick={() => onAsk(question)}
					>
						{question}
					</IOutLinedBtn>
				))}
			</Space>
		)}
		{answer.notes.length > 0 && (
			<Alert type="info" showIcon message={answer.notes.join(' ')} />
		)}
	</div>
);

export default AnswerView;
