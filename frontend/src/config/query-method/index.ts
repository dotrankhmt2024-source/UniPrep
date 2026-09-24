import type { AxiosRequestConfig } from 'axios';
import axiosMethod from './axiosMethod.config';

const queryMethod = {
	get: (url: string, config?: AxiosRequestConfig) => axiosMethod.get(url, config).then((res) => res as unknown),
	post: (url: string, data?: unknown, config?: AxiosRequestConfig) =>
		axiosMethod.post(url, data, config).then((res) => res as unknown),
	put: (url: string, data?: unknown, config?: AxiosRequestConfig) =>
		axiosMethod.put(url, data, config).then((res) => res as unknown),
	patch: (url: string, data?: unknown, config?: AxiosRequestConfig) =>
		axiosMethod.patch(url, data, config).then((res) => res as unknown),
	delete: (url: string, config?: AxiosRequestConfig) => axiosMethod.delete(url, config).then((res) => res as unknown),
};

export default queryMethod;
export type QueryMethod = typeof queryMethod;
