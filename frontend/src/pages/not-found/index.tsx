import { Button, Result } from 'antd';
import { useNavigate } from 'react-router';

/**
 * Trang 404 dùng chung cho cả nhánh công khai lẫn nhánh riêng tư.
 * Không có route khớp thì react-router render phần tử này thay vì màn hình lỗi mặc định.
 */
const NotFoundPage = () => {
	const navigate = useNavigate();

	return (
		<div className="flex min-h-[60vh] items-center justify-center p-gutter">
			<Result
				status="404"
				title="404"
				subTitle="Trang bạn tìm không tồn tại hoặc đã bị di chuyển."
				extra={
					<Button
						type="primary"
						onClick={() => navigate('/', { replace: true })}
					>
						Về trang chủ
					</Button>
				}
			/>
		</div>
	);
};

export default NotFoundPage;
