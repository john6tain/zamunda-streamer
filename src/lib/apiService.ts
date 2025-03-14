import axios from "axios";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || location.origin || 'http://localhost:3000') + '/api';

const apiClient = axios.create({
	baseURL: API_BASE_URL,
	withCredentials: true,
	headers: {
		"Content-Type": "application/json",
	},
});


apiClient.interceptors.response.use(
	(response) => response,
	(error) => {
		console.error("API Error:", error?.response?.data || error.message);
		return Promise.reject(error);
	}
);


export const apiGet = async (endpoint) => {
	try {
		const response = await apiClient.get(endpoint);
		return response.data;
	} catch (error) {
		throw error;
	}
};


export const apiPost = async (endpoint, data = {}) => {
	try {
		const response = await apiClient.post(endpoint, JSON.stringify(data));
		return response.data;
	} catch (error) {
		throw error.response.data;
	}
};


export const apiPut = async (endpoint, data = {}) => {
	try {
		const response = await apiClient.put(endpoint, data);
		return response.data;
	} catch (error) {
		throw error;
	}
};


export const apiDelete = async (endpoint) => {
	try {
		const response = await apiClient.delete(endpoint);
		return response.data;
	} catch (error) {
		throw error;
	}
};

export default apiClient;
