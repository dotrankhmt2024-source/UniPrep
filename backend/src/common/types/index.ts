/**
 * Điểm gom union type dùng chung của backend. Mọi union type mới phải được
 * khai báo ở đây (không dùng TS `enum`) và re-export từ file này.
 */

export * from './ai-job.type';
export * from './analytics.type';
export * from './assessment.type';
export * from './audit.type';
export * from './course.type';
export * from './discussion.type';
export * from './intervention.type';
export * from './learning-activity.type';
export * from './lesson.type';
export * from './notification.type';
export * from './user.type';
