import type { BaseEntity } from './index';

export interface Student extends BaseEntity {
	fullName: string;
	studentCode: string;
	email: string;
	phone?: string | null;
	major?: string | null;
	isActive: boolean;
}
