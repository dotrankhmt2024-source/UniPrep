/**
 * Barrel của tầng `apis/`.
 *
 * Module `student` (CRUD mẫu) đã bị xoá ở E0 vì bảng `students` là bảng legacy:
 * schema thật dùng `users` + `enrollments`.
 *
 * E1-T7 bổ sung `apis/auth` (register/login/refresh/logout/forgot/reset/change-password/me).
 * E2-T4/E2-T5 bổ sung `apis/user` (hồ sơ cá nhân + danh sách/đổi vai trò/đổi trạng thái cho admin).
 * E3 bổ sung `apis/category`, `apis/course`, `apis/lesson`, `apis/material`, `apis/enrollment` và
 * **xoá** `src/mocks/course.ts` — từ đây catalog lấy dữ liệu thật (DoD cấp epic E3).
 *
 * Lưu ý: `queryMethod` KHÔNG export ở đây — dùng `import { queryMethod } from '@/config'`.
 */
export * from './auth';
export * from './category';
export * from './course';
export * from './enrollment';
export * from './lesson';
export * from './material';
export * from './user';
