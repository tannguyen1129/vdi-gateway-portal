"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from './../../utils/axios'; // Đảm bảo đường dẫn đúng
import GuacamoleDisplay from '../../components/GuacamoleDisplay';
import { format } from 'date-fns'; 

export default function ExamPage() {
  const { id } = useParams();
  const router = useRouter();

  // --- STATE ---
  const [userId, setUserId] = useState<number | null>(null);
  const [examDetails, setExamDetails] = useState<any>(null); // Thông tin chung (Lấy để hiển thị ở Sảnh)
  const [vmConfig, setVmConfig] = useState<any>(null);       // Thông tin VM (Có khi Join thành công)
  
  const [accessCode, setAccessCode] = useState('');          // Mật khẩu bài thi
  const [status, setStatus] = useState<'LOADING' | 'LOBBY' | 'DOING' | 'FINISHED'>('LOADING');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 1. KHỞI TẠO: Lấy UserID & Thông tin kỳ thi cơ bản
  useEffect(() => {
    // A. Lấy User từ LocalStorage
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        alert("Vui lòng đăng nhập trước!");
        router.push('/login');
        return;
    }
    const user = JSON.parse(userStr);
    setUserId(user.id);

    // B. Lấy thông tin kỳ thi (Chỉ để hiển thị tên, giờ)
    const fetchExamInfo = async () => {
        try {
            const res = await api.get(`/exams/${id}`);
            setExamDetails(res.data);
            setStatus('LOBBY');
        } catch (err) {
            console.error(err);
            setErrorMsg("Không tìm thấy kỳ thi hoặc lỗi kết nối.");
        }
    };
    fetchExamInfo();
  }, [id, router]);

  // 2. HÀM JOIN EXAM (NÚT "VÀO LÀM BÀI")
  const handleJoinExam = async () => {
    if (!userId) return;
    setIsLoading(true);
    setErrorMsg('');

    try {
        // Gọi API Join (Gửi kèm Access Code nếu có)
        const res = await api.post(`/exams/${id}/join`, {
            userId: userId,
            accessCode: accessCode
        });

        // Thành công -> Lưu cấu hình VM -> Chuyển sang màn hình DOING
        setVmConfig(res.data.vmConfig);
        setStatus('DOING');
        
        // (Optional) Có thể bật chế độ Fullscreen ở đây
        document.documentElement.requestFullscreen().catch(() => {});

    } catch (err: any) {
        // Hiển thị lỗi từ Backend (Chưa đến giờ, Sai code, Hết máy...)
        setErrorMsg(err.response?.data?.message || "Lỗi khi vào phòng thi.");
    } finally {
        setIsLoading(false);
    }
  };

  // 3. HÀM THOÁT THI
  const handleExit = async () => {
    if (!confirm("⚠️ BẠN CÓ CHẮC MUỐN NỘP BÀI VÀ THOÁT?\nMáy ảo sẽ bị thu hồi ngay lập tức.")) return;
    
    try {
        await api.post('/exams/leave', { userId });
        router.push('/dashboard'); // Quay về trang chủ
    } catch (err) {
        console.error("Lỗi khi thoát:", err);
        router.push('/dashboard');
    }
  };

  // --- GIAO DIỆN 1: MÀN HÌNH LOADING ---
  if (status === 'LOADING') {
      return <div className="h-screen flex items-center justify-center">Đang tải dữ liệu...</div>;
  }

  // --- GIAO DIỆN 2: MÀN HÌNH ĐANG THI (CÓ MÁY ẢO) ---
  if (status === 'DOING' && vmConfig) {
      return (
        <div className="h-screen flex flex-col overflow-hidden bg-black">
            {/* Header Mini */}
            <div className="h-10 bg-gray-900 flex items-center justify-between px-4 text-white select-none z-50">
                <div className="flex gap-4 text-sm">
                    <span className="font-bold text-green-400">● Live</span>
                    <span>{examDetails?.name}</span>
                    <span className="text-gray-400">IP: {vmConfig.ip}</span>
                </div>
                <button 
                    onClick={handleExit}
                    className="bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded text-xs font-bold uppercase tracking-wider"
                >
                    Nộp bài & Thoát
                </button>
            </div>

            {/* Guacamole Area */}
            <div className="flex-1 relative">
                <GuacamoleDisplay 
                    connectionConfig={{
                        ...vmConfig, // ip, username, password, port
                        width: window.innerWidth,
                        height: window.innerHeight - 40 // Trừ đi header
                    }} 
                />
            </div>
        </div>
      );
  }

  // --- GIAO DIỆN 3: SẢNH CHỜ (LOBBY) ---
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white max-w-2xl w-full rounded-xl shadow-2xl overflow-hidden">
            {/* Header Sảnh */}
            <div className="bg-blue-600 p-6 text-white text-center">
                <h1 className="text-2xl font-bold uppercase tracking-wide mb-2">
                    {examDetails?.name || 'Đang tải...'}
                </h1>
                <p className="opacity-90 text-sm">
                    Môn thi / Kỳ thi chính thức
                </p>
            </div>

            {/* Body Sảnh */}
            <div className="p-8 space-y-6">
                
                {/* Thông tin giờ giấc */}
                <div className="grid grid-cols-2 gap-4 text-center">
                    <div className="bg-gray-100 p-4 rounded-lg">
                        <p className="text-gray-500 text-xs uppercase">Bắt đầu</p>
                        <p className="font-bold text-gray-800">
                            {examDetails?.startTime ? new Date(examDetails.startTime).toLocaleString('vi-VN') : '--:--'}
                        </p>
                    </div>
                    <div className="bg-gray-100 p-4 rounded-lg">
                        <p className="text-gray-500 text-xs uppercase">Kết thúc</p>
                        <p className="font-bold text-gray-800">
                            {examDetails?.endTime ? new Date(examDetails.endTime).toLocaleString('vi-VN') : '--:--'}
                        </p>
                    </div>
                </div>

                <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 text-sm text-yellow-800">
                    <p className="font-bold">Lưu ý quan trọng:</p>
                    <ul className="list-disc list-inside mt-1 space-y-1">
                        <li>Hệ thống sẽ tự động ghi hình quá trình làm bài.</li>
                        <li>Mỗi sinh viên được cấp 01 máy ảo riêng biệt.</li>
                        <li>Không tải lại trang (F5) khi đang làm bài.</li>
                    </ul>
                </div>

                {/* Form nhập Access Code (Nếu cần) */}
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                        Mã truy cập (Access Code)
                    </label>
                    <input 
                        type="password" 
                        placeholder="Nhập mã bảo mật nếu giám thị yêu cầu..."
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                    />
                </div>

                {/* Khu vực thông báo lỗi */}
                {errorMsg && (
                    <div className="bg-red-100 text-red-700 p-3 rounded-lg text-center font-medium border border-red-200 animate-pulse">
                        ⚠️ {errorMsg}
                    </div>
                )}

                {/* Nút hành động */}
                <button 
                    onClick={handleJoinExam}
                    disabled={isLoading || !userId}
                    className={`w-full py-4 rounded-lg font-bold text-lg uppercase tracking-wide transition transform active:scale-95 shadow-lg
                        ${isLoading || !userId
                            ? 'bg-gray-400 cursor-not-allowed text-gray-200' 
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                        }`}
                >
                    {isLoading ? (
                        <span className="flex items-center justify-center gap-2">
                            <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Đang kết nối máy ảo...
                        </span>
                    ) : (
                        "Vào làm bài thi"
                    )}
                </button>
                
                <div className="text-center">
                    <button onClick={() => router.back()} className="text-gray-500 hover:text-gray-700 text-sm hover:underline">
                        ← Quay lại danh sách
                    </button>
                </div>
            </div>
        </div>
    </div>
  );
}