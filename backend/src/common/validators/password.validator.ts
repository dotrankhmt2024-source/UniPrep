import {
	registerDecorator,
	ValidationArguments,
	ValidationOptions,
} from 'class-validator';

/**
 * Chính sách mật khẩu của hệ thống (`docs/02-specs/api-specification.md` §5.1) — **phải khớp**
 * `frontend/src/components/PasswordInput/PasswordInput.tsx`, kể cả thứ tự kiểm tra và câu message,
 * nếu không người dùng sẽ thấy FE báo một kiểu còn API báo kiểu khác cho cùng một mật khẩu.
 */
export const PASSWORD_POLICY_MESSAGES = {
	length: 'Mật khẩu phải chứa từ 8 đến 16 ký tự!',
	uppercase: 'Mật khẩu phải chứa chữ viết hoa!',
	lowercase: 'Mật khẩu phải chứa chữ viết thường!',
	digit: 'Mật khẩu phải chứa chữ số!',
	special: 'Mật khẩu phải chứa ký tự đặc biệt!',
} as const;

/** Trả về câu lỗi đầu tiên vi phạm, `null` nếu mật khẩu hợp lệ (đúng thứ tự kiểm tra của FE). */
export const findPasswordPolicyViolation = (value: string): string | null => {
	if (!/^.{8,16}$/.test(value)) return PASSWORD_POLICY_MESSAGES.length;
	if (!/(?=.*[A-Z])/.test(value)) return PASSWORD_POLICY_MESSAGES.uppercase;
	if (!/(?=.*[a-z])/.test(value)) return PASSWORD_POLICY_MESSAGES.lowercase;
	if (!/(?=.*\d)/.test(value)) return PASSWORD_POLICY_MESSAGES.digit;
	if (!/(?=.*[!@#$%^&*])/.test(value)) return PASSWORD_POLICY_MESSAGES.special;
	return null;
};

/**
 * `@IsStrongPassword()` — dùng trong DTO thay cho chuỗi `@Matches()` lặp lại 5 lần, và trả message
 * tiếng Việt giống FE (class-validator mặc định trả message tiếng Anh).
 */
export const IsStrongPassword = (validationOptions?: ValidationOptions) => {
	return (object: object, propertyName: string) => {
		registerDecorator({
			name: 'isStrongPassword',
			target: object.constructor,
			propertyName,
			options: validationOptions,
			validator: {
				validate(value: unknown): boolean {
					return (
						typeof value === 'string' &&
						findPasswordPolicyViolation(value) === null
					);
				},
				defaultMessage(args: ValidationArguments): string {
					const value = args.value as unknown;
					if (typeof value !== 'string') {
						return PASSWORD_POLICY_MESSAGES.length;
					}
					return (
						findPasswordPolicyViolation(value) ??
						PASSWORD_POLICY_MESSAGES.length
					);
				},
			},
		});
	};
};
