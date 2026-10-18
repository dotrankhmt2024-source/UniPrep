import { useState } from 'react';
import { Button, Upload, message } from 'antd';
import type { UploadFile } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import { deleteSubmissionFile, uploadSubmissionFile } from '@/apis/assessment';
import { Icon } from '@/components';
import { getApiErrorMessage } from '@/config/query-method/axiosMethod.config';
import {
	downloadSubmissionFileToDisk,
	formatFileSize,
} from '@/utils/submission-file';
import type { SubmissionFile } from '@/types';

interface SubmissionFilePanelProps {
	submissionId: string;
	files: SubmissionFile[];
	maxFiles: number;
	/** Lượt đã nộp/hết hạn: chỉ xem và tải, không thêm/xoá được (server cũng chặn bằng `409`). */
	readOnly?: boolean;
	onFilesChange: (files: SubmissionFile[]) => void;
}

/**
 * Khu vực nộp tệp của học viên (yêu cầu 4.4 — "bài tập nộp tệp").
 *
 * `beforeUpload` trả `false` để antd **không** tự gửi request rồi xoá danh sách tệp ngay: antd không
 * biết endpoint của dự án và sẽ để lại thẻ "đang tải" treo — cùng cách làm đã dùng ở
 * `teacher/content-editor`.
 */
const SubmissionFilePanel = ({
	submissionId,
	files,
	maxFiles,
	readOnly = false,
	onFilesChange,
}: SubmissionFilePanelProps) => {
	const [pendingFile, setPendingFile] = useState<UploadFile | null>(null);
	const [busyFileId, setBusyFileId] = useState<string | null>(null);

	const isUploading = pendingFile?.status === 'uploading';
	const reachedLimit = files.length >= maxFiles;
	const canUpload = !readOnly && !reachedLimit;

	const handleUpload = async (file: File) => {
		setPendingFile({ uid: file.name, name: file.name, status: 'uploading' });
		try {
			const response = await uploadSubmissionFile(submissionId, file);
			if (response.data) onFilesChange([...files, response.data]);
			message.success('Đã tải tệp lên.');
		} catch (uploadError) {
			// Backend là nơi thực thi whitelist định dạng, trần dung lượng và trần số tệp; UI chỉ
			// hiển thị đúng thông báo của server thay vì đoán lại luật.
			message.error(getApiErrorMessage(uploadError, 'Không tải được tệp lên.'));
		} finally {
			// Xoá danh sách tệp để lần chọn sau (kể cả cùng tệp) vẫn kích hoạt upload.
			setPendingFile(null);
		}
	};

	const handleDelete = async (file: SubmissionFile) => {
		setBusyFileId(file.id);
		try {
			await deleteSubmissionFile(file.id);
			onFilesChange(files.filter((item) => item.id !== file.id));
			message.success('Đã xoá tệp.');
		} catch (deleteError) {
			message.error(getApiErrorMessage(deleteError, 'Không xoá được tệp.'));
		} finally {
			setBusyFileId(null);
		}
	};

	const handleDownload = async (file: SubmissionFile) => {
		setBusyFileId(file.id);
		try {
			await downloadSubmissionFileToDisk(file);
		} catch (downloadError) {
			message.error(
				getApiErrorMessage(downloadError, 'Không tải được tệp xuống.'),
			);
		} finally {
			setBusyFileId(null);
		}
	};

	return (
		<section className="space-y-space-sm rounded-lg border border-outline-variant p-space-md">
			<div className="flex items-center justify-between gap-space-sm">
				<h3 className="font-title-md text-on-surface">
					Tệp bài làm ({files.length}/{maxFiles})
				</h3>
				{canUpload && (
					<Upload
						beforeUpload={(file) => {
							void handleUpload(file);
							return false;
						}}
						showUploadList={false}
						disabled={isUploading}
					>
						<Button icon={<UploadOutlined />} loading={isUploading}>
							Chọn tệp
						</Button>
					</Upload>
				)}
			</div>

			{readOnly && (
				<p className="font-body-sm text-on-surface-variant">
					Bài đã nộp nên không thể thêm hoặc xoá tệp.
				</p>
			)}
			{!readOnly && reachedLimit && (
				<p className="font-body-sm text-on-surface-variant">
					Đã đạt số tệp tối đa cho một lượt nộp.
				</p>
			)}

			{files.length === 0 ? (
				<p className="font-body-sm text-on-surface-variant">
					Chưa có tệp nào. Bài tập này yêu cầu nộp ít nhất một tệp.
				</p>
			) : (
				<ul className="space-y-space-xs">
					{files.map((file) => (
						<li
							key={file.id}
							className="flex items-center justify-between gap-space-sm border-b border-outline-variant pb-space-xs"
						>
							<span className="flex min-w-0 flex-col">
								<span className="truncate font-body-md text-on-surface">
									{file.originalName}
								</span>
								<span className="font-body-sm text-on-surface-variant">
									{formatFileSize(file.fileSizeBytes)}
								</span>
							</span>
							<span className="flex shrink-0 items-center gap-space-xs">
								{file.canPreview && (
									<Button
										size="small"
										href={file.viewUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										Xem
									</Button>
								)}
								<Button
									size="small"
									loading={busyFileId === file.id}
									onClick={() => void handleDownload(file)}
								>
									Tải xuống
								</Button>
								{!readOnly && (
									<Button
										size="small"
										danger
										loading={busyFileId === file.id}
										onClick={() => void handleDelete(file)}
										aria-label={`Xoá tệp ${file.originalName}`}
									>
										<Icon name="delete" size={16} />
									</Button>
								)}
							</span>
						</li>
					))}
				</ul>
			)}
		</section>
	);
};

export default SubmissionFilePanel;
