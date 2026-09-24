export interface BaseEntity {
	id: string;
	createdAt: string;
	updatedAt: string;
}

export interface DefaultResponseType<T> {
	error: boolean;
	data: T | null;
	message: string;
}

export interface PageMetaDto {
	page: number;
	take: number;
	itemCount: number;
	pageCount: number;
	hasPreviousPage: boolean;
	hasNextPage: boolean;
}

export interface PageOptions {
	page?: number;
	take?: number;
}

export * from './student';
export * from './course';
