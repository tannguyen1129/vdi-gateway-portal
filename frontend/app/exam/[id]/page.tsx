"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from './../../utils/axios';
import GuacamoleDisplay from '../../components/GuacamoleDisplay';

export default function ExamPage() {
  const { id } = useParams();
  const router = useRouter();

  // --- STATE ---
  const [userId, setUserId] = useState<number | null>(null);
  const [examDetails, setExamDetails] = useState<any>(null);
  
  // THAY ĐỔI 1: Dùng Token thay vì vmConfig trần trụi
  const [token, setToken] = useState<string | null>(null);
  
  const [accessCode, setAccessCode] = useState('');
  const [status, setStatus] = useState<'LOADING' | 'LOBBY' | 'DOING' | 'FINISHED'>('LOADING');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // 1. KHỞI TẠO
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        alert("Vui lòng đăng nhập trước!");
        router.push('/login');
        return;
    }
    const user = JSON.parse(userStr);
    setUserId(user.id);

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

  // 2. HÀM JOIN EXAM
  const handleJoinExam = async () => {
    if (!userId) return;
    setIsLoading(true);
    setErrorMsg('');

    try {
        const res = await api.post(`/exams/${id}/join`, {
            userId: userId,
            accessCode: accessCode
        });

        // THAY ĐỔI 2: Nhận Token mã hóa từ Backend
        if (res.data.connectionToken) {
            setToken(res.data.connectionToken);
            setStatus('DOING');
            // Bật Fullscreen
            document.documentElement.requestFullscreen().catch(() => {});
        } else {
            throw new Error("Không nhận được tín hiệu kết nối máy ảo.");
        }

    } catch (err: any) {
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
        router.push('/dashboard');
    } catch (err) {
        console.error("Lỗi khi thoát:", err);
        router.push('/dashboard');
    }
  };

  // --- UI LOADING ---
  if (status === 'LOADING') {
      return <div className="h-screen flex items-center justify-center">Đang tải dữ liệu...</div>;
  }

  // --- UI LÀM BÀI (DOING) ---
  // Chỉ hiện khi có Token
  if (status === 'DOING' && token) {
      return (
        <div className="h-screen flex flex-col overflow-hidden bg-black">
            {/* Header Mini */}
            <div className="h-10 bg-gray-900 flex items-center justify-between px-4 text-white select-none z-50">
                <div className="flex gap-4 text-sm">
                    <span className="font-bold text-green-400">● Live</span>
                    <span>{examDetails?.name}</span>
                    {/* Token đã mã hóa IP nên không hiển thị IP ở đây nữa để bảo mật */}
                    <span className="text-gray-500 text-xs italic opacity-70">Secured Connection</span>
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
                {/* THAY ĐỔI 3: Truyền Token vào Component */}
                <GuacamoleDisplay token={token} />
            </div>
        </div>
      );
  }

  // --- UI SẢNH CHỜ (LOBBY) ---
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white max-w-2xl w-full rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-blue-600 p-6 text-white text-center">
                <h1 className="text-2xl font-bold uppercase tracking-wide mb-2">
                    {examDetails?.name || 'Đang tải...'}
                </h1>
                <p className="opacity-90 text-sm">Môn thi / Kỳ thi chính thức</p>
            </div>

            <div className="p-8 space-y-6">
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
                        <li>Hệ thống giám sát và ghi hình tự động.</li>
                        <li>Kết nối được mã hóa đầu cuối (End-to-End Encryption).</li>
                        <li>Tuyệt đối không nhấn F5 (Tải lại trang).</li>
                    </ul>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Mã truy cập (Access Code)</label>
                    <input 
                        type="password" 
                        placeholder="Nhập mã bảo mật nếu giám thị yêu cầu..."
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 focus:ring-2 focus:ring-blue-500 focus:outline-none transition"
                        value={accessCode}
                        onChange={(e) => setAccessCode(e.target.value)}
                    />
                </div>

                {errorMsg && (
                    <div className="bg-red-100 text-red-700 p-3 rounded-lg text-center font-medium border border-red-200 animate-pulse">
                        ⚠️ {errorMsg}
                    </div>
                )}

                <button 
                    onClick={handleJoinExam}
                    disabled={isLoading || !userId}
                    className={`w-full py-4 rounded-lg font-bold text-lg uppercase tracking-wide transition transform active:scale-95 shadow-lg
                        ${isLoading || !userId
                            ? 'bg-gray-400 cursor-not-allowed text-gray-200' 
                            : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white'
                        }`}
                >
                    {isLoading ? "Đang thiết lập môi trường thi..." : "Vào làm bài thi"}
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