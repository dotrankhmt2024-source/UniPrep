import axios from 'axios';

const axiosMethod = axios.create({
	baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api',
	timeout: 15000,
});

axiosMethod.interceptors.response.use(
	(response) => response.data,
	(error) => {
		// NOTE: centralize error normalization here once the AI/notification toast layer exists
		return Promise.reject(error);
	},
);

export default axiosMethod;
