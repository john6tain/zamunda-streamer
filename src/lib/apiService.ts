import axios, {AxiosError} from "axios";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || location.origin || 'http://localhost:3000') + '/api';

const apiClient = axios.create({
	baseURL: API_BASE_URL,
	withCredentials: true,
	headers: {
		"Content-Type": "application/json",
	},
});

export const axiosInterceptor = (setLoading: (v: boolean) => void) => {
	apiClient.interceptors.request.use(
		(config) => {
			setLoading(true); // request started
			return config;
		},
		(error) => {
			setLoading(false);
			return Promise.reject(error);
		}
	);
	apiClient.interceptors.response.use(
		(response) => {
			setLoading(false); // request finished
			return response;
		},
		(error) => {
			setLoading(false);
			console.error("API Error:", error?.response?.data || error.message);
			return Promise.reject(error);
		}
	);
};


export const apiGet = async (endpoint: string) => {
	try {
		const response = await apiClient.get(endpoint);
		return response.data;
	} catch (error) {
		throw error;
	}
};


export const apiPost = async (endpoint: string, data = {}) => {
	try {
		const response = await apiClient.post(endpoint, JSON.stringify(data));
		return response.data;
	} catch (error) {
		const axiosError = error as AxiosError; // Type assertion
		if (axiosError.response) {
			throw axiosError.response.data;
		} else {
			throw new Error("An unexpected error occurred");
		}
	}
};


export const apiPut = async (endpoint: string, data = {}) => {
	try {
		const response = await apiClient.put(endpoint, data);
		return response.data;
	} catch (error) {
		const axiosError = error as AxiosError; // Type assertion
		if (axiosError.response) {
			throw axiosError.response.data;
		} else {
			throw new Error("An unexpected error occurred");
		}
	}
};


export const apiDelete = async (endpoint: string) => {
	try {
		const response = await apiClient.delete(endpoint);
		return response.data;
	} catch (error) {
		const axiosError = error as AxiosError; // Type assertion
		if (axiosError.response) {
			throw axiosError.response.data;
		} else {
			throw new Error("An unexpected error occurred");
		}
	}
};

export default apiClient;
