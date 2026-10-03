import { SetMetadata } from '@nestjs/common';

export const OWN_RESOURCE_PARAM_KEY = 'ownResourceParam';

/**
 * Khai báo rằng tham số đường dẫn `param` phải là **chính chủ** dữ liệu đang gọi (E1-T6, chống
 * IDOR). `OwnershipGuard` đọc metadata này rồi so `params[param]` với `request.user.id`.
 *
 * Vì sao kiểm tra bằng decorator chứ không bằng `if` trong từng service: quên một `if` trong
 * service là lỗ hổng IDOR không nhìn thấy khi review; decorator biến việc đó thành khai báo
 * tường minh, còn guard là nơi duy nhất quyết định.
 */
export const OwnResource = (param = 'id') =>
	SetMetadata(OWN_RESOURCE_PARAM_KEY, param);
