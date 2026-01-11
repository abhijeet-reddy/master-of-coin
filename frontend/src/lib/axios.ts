import axios, { type AxiosError, type InternalAxiosRequestConfig } from 'axios';
import type { ApiError } from '@/types';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: (import.meta.env.VITE_API_URL as string | undefined) || 'http://localhost:8080/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - attach JWT token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('auth_token');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: Error) => {
    return Promise.reject(error);
  }
);

// Response interceptor - handle errors
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  (error: AxiosError<ApiError>) => {
    // Handle 401 Unauthorized - clear token and redirect to login
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');

      // Only redirect if not already on login/register page
      if (
        !window.location.pathname.startsWith('/login') &&
        !window.location.pathname.startsWith('/register')
      ) {
        window.location.href = '/login';
      }
    }

    // Handle network errors
    if (!error.response) {
      const networkError: ApiError = {
        error: 'network_error',
        message: 'Unable to connect to the server. Please check your internet connection.',
        details: {},
      };
      return Promise.reject(new Error(JSON.stringify(networkError)));
    }

    // Handle API errors with user-friendly messages
    const apiError: ApiError = error.response.data || {
      error: 'unknown_error',
      message: 'An unexpected error occurred. Please try again.',
      details: {},
    };

    // Enhance error messages for common status codes
    if (error.response.status === 403) {
      apiError.message = apiError.message || 'You do not have permission to perform this action.';
    } else if (error.response.status === 404) {
      apiError.message = apiError.message || 'The requested resource was not found.';
    } else if (error.response.status === 409) {
      apiError.message = apiError.message || 'This resource already exists.';
    } else if (error.response.status === 422) {
      apiError.message =
        apiError.message || 'Unable to process your request. Please check your input.';
    } else if (error.response.status >= 500) {
      apiError.message = apiError.message || 'A server error occurred. Please try again later.';
    }

    return Promise.reject(new Error(JSON.stringify(apiError)));
  }
);

export default apiClient;
