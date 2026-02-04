import axios from 'axios';

// Logic xác định URL thông minh hơn cho Nginx
const getBaseUrl = () => {
  // 1. Nếu đang chạy trên Server (SSR - Server Side Rendering)
  // Phải gọi trực tiếp tên service trong Docker để nhanh nhất
  if (typeof window === 'undefined') {
    return 'http://umt_backend:3000/api'; 
  }

  // 2. Nếu đang chạy trên Client (Trình duyệt)
  // Chỉ trả về '/api' để trình duyệt tự ghép với domain hiện tại (Port 80)
  // Ví dụ: http://217.216.33.134/api
  return '/api';
};

const axiosInstance = axios.create({
  baseURL: getBaseUrl(),
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Quan trọng để gửi cookie/token
});

// ... giữ nguyên các phần interceptors phía dưới ...
// (ví dụ: axiosInstance.interceptors.request.use...)

export default axiosInstance;