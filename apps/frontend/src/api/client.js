import axios from 'axios';
import useAuthStore from '../stores/authStore';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1',
  withCredentials: true,
});

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export const authApi = {
  login: (data) => apiClient.post('/auth/login', data),
  register: (data) => apiClient.post('/auth/register', data),
  me: () => apiClient.get('/auth/me'),
};

export const bankingApi = {
  getAccounts: () => apiClient.get('/accounts'),
  getTransactions: (limit = 5) => apiClient.get(`/ledger?limit=${limit}`),
  getBeneficiaries: () => apiClient.get('/beneficiaries'),
  addBeneficiary: (data) => apiClient.post('/beneficiaries', data),
  transfer: (data) => apiClient.post('/transfers', data),
};

export const billsApi = {
  getCategories: () => apiClient.get('/bills/categories'),
  fetchBill: (data) => apiClient.post('/bills/fetch', data),
  payBill: (data) => apiClient.post('/bills/pay', data),
};

export default apiClient;
