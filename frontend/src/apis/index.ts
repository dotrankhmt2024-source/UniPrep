/**
 * Barrel của tầng `apis/`.
 *
 * Module `student` (CRUD mẫu) đã bị xoá ở E0 vì bảng `students` là bảng legacy:
 * schema thật dùng `users` + `enrollments`.
 *
 * E1-T7 bổ sung `apis/auth` (register/login/refresh/logout/forgot/reset/change-password/me).
 * Module `course` vẫn lấy từ `src/mocks/course.ts` cho tới khi E3-T6 nối catalog thật.
 *
 * Lưu ý: `queryMethod` KHÔNG export ở đây — dùng `import { queryMethod } from '@/config'`.
 */
export * from './auth';
