import { queryMethod } from '@/config';
import type { DefaultResponseType, Student } from '@/types';

export interface CreateStudentPayload {
	fullName: string;
	studentCode: string;
	email: string;
	phone?: string;
	major?: string;
	isActive?: boolean;
}

export type UpdateStudentPayload = Partial<CreateStudentPayload>;

export const getStudents = async () => {
	return (await queryMethod.get('students')) as DefaultResponseType<Student[]>;
};

export const getStudentById = async (id: string) => {
	return (await queryMethod.get(`students/${id}`)) as DefaultResponseType<Student>;
};

export const createStudent = async (data: CreateStudentPayload) => {
	return (await queryMethod.post('students', data)) as DefaultResponseType<Student>;
};

export const updateStudent = async (id: string, data: UpdateStudentPayload) => {
	return (await queryMethod.patch(`students/${id}`, data)) as DefaultResponseType<Student>;
};

export const deleteStudent = async (id: string) => {
	return (await queryMethod.delete(`students/${id}`)) as DefaultResponseType<null>;
};
