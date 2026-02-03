// frontend/app/utils/axios.ts
import axios from 'axios';

// 1. Lấy URL gốc từ biến môi trường (hoặc fallback)
let baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://217.216.33.134:4000';

// 2. Xử lý chuẩn hóa URL: 
// - Xóa dấu gạch chéo cuối nếu có
if (baseURL.endsWith('/')) {
    baseURL = baseURL.slice(0, -1);
}

// - Nếu URL chưa có đuôi /api thì cộng thêm vào
// (Backend NestJS của bạn đang setGlobalPrefix('api') nên bắt buộc phải có /api)
if (!baseURL.endsWith('/api')) {
    baseURL += '/api';
}

console.log("🔗 Axios Base URL:", baseURL); // Log ra để kiểm tra

const api = axios.create({
  baseURL: baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Thêm timeout để tránh treo quá lâu nếu mạng lag
  timeout: 10000, 
});

// Interceptor để tự động gắn Token vào mọi request
api.interceptors.request.use(
  (config) => {
    // Chỉ chạy ở phía Client (trình duyệt)
    if (typeof window !== 'undefined') {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user.accessToken) {
             config.headers.Authorization = `Bearer ${user.accessToken}`;
          }
        } catch (e) {}
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

export default api;
