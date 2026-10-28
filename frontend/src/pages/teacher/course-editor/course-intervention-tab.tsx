import { useEffect, useState } from 'react';
import {
	Button,
	Card,
	Col,
	Form,
	Input,
	Modal,
	Row,
	Select,
	Statistic,
	Table,
	Tag,
	Typography,
	message,
} from 'antd';
import {
	getCourseInterventions,
	getCohorts,
	runPromptIntervention,
} from '@/apis';
import { Icon } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import type {
	CohortItem,
	InterventionRecord,
	RunPromptInterventionResponse,
	StudentInterventionItemResult,
} from '@/types';

interface CourseInterventionTabProps {
	courseId: string;
}

const { TextArea } = Input;
const { Title, Paragraph, Text } = Typography;

export const CourseInterventionTab = ({
	courseId,
}: CourseInterventionTabProps) => {
	const [cohorts, setCohorts] = useState<CohortItem[]>([]);
	const [loadingCohorts, setLoadingCohorts] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [resultData, setResultData] =
		useState<RunPromptInterventionResponse | null>(null);

	// Lịch sử can thiệp
	const [history, setHistory] = useState<InterventionRecord[]>([]);
	const [loadingHistory, setLoadingHistory] = useState(false);

	// Modal xem chi tiết nội dung thông báo đã gửi cho 1 sinh viên
	const [selectedResult, setSelectedResult] =
		useState<StudentInterventionItemResult | null>(null);
	const [modalVisible, setModalVisible] = useState(false);

	// Tải danh sách lớp (cohorts) và lịch sử can thiệp của khoá học khi vào tab
	useEffect(() => {
		const loadInitialData = async () => {
			setLoadingCohorts(true);
			setLoadingHistory(true);
			try {
				const [cohortRes, historyRes] = await Promise.all([
					getCohorts(courseId),
					getCourseInterventions(courseId),
				]);

				if (cohortRes.data) {
					setCohorts(cohortRes.data.items ?? []);
				}
				if (historyRes.data) {
					setHistory(historyRes.data.items ?? []);
				}
			} catch (error) {
				message.error(
					getApiErrorMessage(error, 'Không thể tải dữ liệu ban đầu.'),
				);
			} finally {
				setLoadingCohorts(false);
				setLoadingHistory(false);
			}
		};

		void loadInitialData();
	}, [courseId]);

	const handleRunIntervention = async (values: {
		prompt: string;
		cohortId?: string;
		channel?: 'in_app' | 'email' | 'websocket';
		dryRun?: boolean;
	}) => {
		setSubmitting(true);
		setResultData(null);
		try {
			const res = await runPromptIntervention({
				courseId,
				prompt: values.prompt,
				cohortId: values.cohortId || undefined,
				channel: values.channel || 'in_app',
				dryRun: values.dryRun || false,
			});

			if (res.data) {
				if (!res.data.isPromptClear) {
					message.warning(
						res.data.clarificationRequest ||
							'Prompt chưa đủ rõ, vui lòng bổ sung tiêu chí!',
					);
				} else {
					message.success(
						`Đã hoàn tất phân tích! Gửi thành công: ${res.data.summary.sentCount} học viên.`,
					);
					// Tải lại lịch sử sau khi chạy thành công
					const historyRes = await getCourseInterventions(courseId);
					if (historyRes.data) {
						setHistory(historyRes.data.items ?? []);
					}
				}
				setResultData(res.data);
			}
		} catch (error) {
			message.error(getApiErrorMessage(error, 'Thực thi cảnh báo thất bại.'));
		} finally {
			setSubmitting(false);
		}
	};

	const getStatusTag = (status: StudentInterventionItemResult['status']) => {
		switch (status) {
			case 'sent':
				return <Tag color="success">Đã gửi thông báo</Tag>;
			case 'skipped_by_asp':
				return <Tag color="default">Bỏ qua (ASP)</Tag>;
			case 'blocked_ungrounded':
				return <Tag color="error">Chặn (Lệch dữ kiện)</Tag>;
			default:
				return <Tag>{status}</Tag>;
		}
	};

	return (
		<div className="space-y-space-lg">
			<Card
				title="Chạy hệ thống Cảnh báo sớm & Can thiệp AI (MCP + ASP + LLM)"
				bordered={false}
				className="shadow-sm"
			>
				<Paragraph className="text-on-surface-variant">
					Nhập yêu cầu bằng ngôn ngữ tự nhiên (prompt). Hệ thống sẽ tự động tổng
					hợp dữ liệu hành vi học tập (MCP), đánh giá điều kiện (ASP), soạn thảo
					cá nhân hoá (LLM) và kiểm chứng chống ảo giác trước khi gửi thông báo
					tới học viên.
				</Paragraph>

				<Form
					layout="vertical"
					onFinish={(values) => void handleRunIntervention(values)}
					initialValues={{
						channel: 'in_app',
						dryRun: false,
						prompt:
							'Kiểm tra các học viên có tiến độ dưới 50% hoặc trễ hạn bài học để gửi nhắc nhở ôn tập.',
					}}
				>
					<Form.Item
						name="prompt"
						label="Yêu cầu kiểm tra & cảnh báo (Prompt)"
						rules={[
							{ required: true, message: 'Vui lòng nhập prompt cho AI!' },
						]}
					>
						<TextArea
							rows={3}
							placeholder="Ví dụ: Kiểm tra học viên có tiến độ dưới 50% hoặc vắng mặt trên 3 ngày..."
						/>
					</Form.Item>

					<Row gutter={16}>
						<Col xs={24} md={12}>
							<Form.Item name="cohortId" label="Lớp học / Nhóm (Tùy chọn)">
								<Select
									placeholder="Tất cả học viên trong khoá học"
									allowClear
									loading={loadingCohorts}
									options={cohorts.map((c) => ({
										label: `${c.name} (${c.classCode || c.groupCode || 'Lớp'})`,
										value: c.id,
									}))}
								/>
							</Form.Item>
						</Col>
						<Col xs={24} md={12}>
							<Form.Item name="channel" label="Kênh thông báo">
								<Select
									options={[
										{ label: 'Trong ứng dụng (In-app)', value: 'in_app' },
										{ label: 'Email', value: 'email' },
										{ label: 'Thời gian thực (WebSocket)', value: 'websocket' },
									]}
								/>
							</Form.Item>
						</Col>
					</Row>

					<Form.Item>
						<Button
							type="primary"
							htmlType="submit"
							loading={submitting}
							icon={<Icon name="bolt" size={16} />}
							size="large"
						>
							Chạy kiểm tra & Gửi cảnh báo AI
						</Button>
					</Form.Item>
				</Form>
			</Card>

			{/* Hiển thị kết quả sau khi chạy prompt */}
			{resultData && (
				<Card
					title="Báo cáo kết quả thực thi"
					bordered={false}
					className="shadow-sm"
				>
					{!resultData.isPromptClear ? (
						<div className="rounded-lg bg-error/10 p-4 text-error">
							<Title level={5} className="text-error">
								Yêu cầu chưa đủ rõ
							</Title>
							<Paragraph>{resultData.clarificationRequest}</Paragraph>
						</div>
					) : (
						<div className="space-y-space-md">
							<Row gutter={16}>
								<Col xs={12} sm={6}>
									<Statistic
										title="Đã đánh giá"
										value={resultData.summary.totalEvaluated}
									/>
								</Col>
								<Col xs={12} sm={6}>
									<Statistic
										title="Đã gửi thông báo"
										value={resultData.summary.sentCount}
										valueStyle={{ color: '#3f8600' }}
									/>
								</Col>
								<Col xs={12} sm={6}>
									<Statistic
										title="Bỏ qua (ASP)"
										value={resultData.summary.skippedCount}
									/>
								</Col>
								<Col xs={12} sm={6}>
									<Statistic
										title="Chặn (Lệch dữ kiện)"
										value={resultData.summary.blockedCount}
										valueStyle={{ color: '#cf1322' }}
									/>
								</Col>
							</Row>

							<Table
								dataSource={resultData.results}
								rowKey="userId"
								pagination={{ pageSize: 5 }}
								columns={[
									{
										title: 'Học viên',
										dataIndex: 'fullName',
										key: 'fullName',
										render: (text, record) => (
											<div>
												<Text strong>{text}</Text>
												<br />
												<Text type="secondary" className="text-xs">
													{record.studentCode || record.userId}
												</Text>
											</div>
										),
									},
									{
										title: 'Tiến độ / Quá hạn',
										key: 'context',
										render: (_, record) => (
											<span>
												{record.contextSummary.progressPercent}% ·{' '}
												{record.contextSummary.overdueLessonsCount} bài quá hạn
											</span>
										),
									},
									{
										title: 'Trạng thái xử lý',
										dataIndex: 'status',
										key: 'status',
										render: (status) => getStatusTag(status),
									},
									{
										title: 'Lý do / Diễn giải ASP',
										dataIndex: 'aspReason',
										key: 'aspReason',
									},
									{
										title: 'Thao tác',
										key: 'action',
										render: (_, record) =>
											record.generatedContent ? (
												<Button
													type="link"
													onClick={() => {
														setSelectedResult(record);
														setModalVisible(true);
													}}
												>
													Xem tin nhắn
												</Button>
											) : null,
									},
								]}
							/>
						</div>
					)}
				</Card>
			)}

			{/* Lịch sử các lần can thiệp trong khoá học */}
			<Card
				title="Lịch sử các lần can thiệp đã gửi"
				bordered={false}
				className="shadow-sm"
			>
				<Table
					dataSource={history}
					rowKey="id"
					loading={loadingHistory}
					pagination={{ pageSize: 10 }}
					columns={[
						{
							title: 'Thời gian',
							dataIndex: 'createdAt',
							key: 'createdAt',
							render: (val) => new Date(val).toLocaleString('vi-VN'),
						},
						{
							title: 'Học viên nhận',
							key: 'user',
							render: (_, record) => record.user?.fullName ?? record.userId,
						},
						{
							title: 'Tiêu đề thông báo',
							dataIndex: 'title',
							key: 'title',
						},
						{
							title: 'Kênh',
							dataIndex: 'channel',
							key: 'channel',
							render: (ch) => <Tag>{ch}</Tag>,
						},
						{
							title: 'Trạng thái',
							dataIndex: 'status',
							key: 'status',
							render: (st) => <Tag color="blue">{st}</Tag>,
						},
					]}
				/>
			</Card>

			{/* Modal xem nội dung tin nhắn AI soạn */}
			<Modal
				title={selectedResult?.generatedTitle || 'Chi tiết thông báo AI'}
				open={modalVisible}
				onOk={() => setModalVisible(false)}
				onCancel={() => setModalVisible(false)}
				footer={[
					<Button
						key="close"
						type="primary"
						onClick={() => setModalVisible(false)}
					>
						Đóng
					</Button>,
				]}
			>
				{selectedResult && (
					<div className="space-y-4">
						<div>
							<Text type="secondary">Học viên nhận: </Text>
							<Text strong>{selectedResult.fullName}</Text>
						</div>
						<div>
							<Text type="secondary">Đánh giá ASP: </Text>
							<Text>{selectedResult.aspReason}</Text>
						</div>
						<div className="rounded-lg bg-surface-container-low p-3">
							<Text strong>Nội dung thông báo (LLM soạn):</Text>
							<div className="mt-2 whitespace-pre-wrap text-on-surface">
								{selectedResult.generatedContent}
							</div>
						</div>
						{selectedResult.groundingIssues &&
							selectedResult.groundingIssues.length > 0 && (
								<div className="rounded-lg bg-error/10 p-3 text-error">
									<Text strong className="text-error">
										Cảnh báo Grounding:
									</Text>
									<ul className="list-disc pl-4">
										{selectedResult.groundingIssues.map((issue, idx) => (
											<li key={idx}>{issue}</li>
										))}
									</ul>
								</div>
							)}
					</div>
				)}
			</Modal>
		</div>
	);
};

export default CourseInterventionTab;
