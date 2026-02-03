"use client";
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from './../../utils/axios';

// Import 2 component con đã tách
import ExamLobby from './components/ExamLobby';
import ExamMachine from './components/ExamMachine';

export default function ExamPage() {
  const { id } = useParams();
  const router = useRouter();

  // State quản lý dữ liệu
  const [user, setUser] = useState<any>(null);
  const [exam, setExam] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  
  // State quản lý thông tin hiển thị trên thanh Header
  const [vmInfo, setVmInfo] = useState<{ name: string; ip?: string } | null>(null);
  
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isReady, setIsReady] = useState(false); 
  const [vdiEndTime, setVdiEndTime] = useState<string>("");

  // 1. Check User & Load Exam Info
  useEffect(() => {
    const userStr = localStorage.getItem('user');
    if (!userStr) {
        router.push('/login');
        return;
    }
    const parsedUser = JSON.parse(userStr);
    setUser(parsedUser);

    const fetchExam = async () => {
        try {
            const res = await api.get(`/exams/${id}`);
            setExam(res.data);

            if (res.data.endTime) {
                const end = new Date(res.data.endTime);
                // Cộng thêm 10 phút cho máy ảo
                const vdiEnd = new Date(end.getTime() + 10 * 60000);
                setVdiEndTime(vdiEnd.toISOString());
            }

            setIsReady(true);
        } catch (err) {
            alert("Không tìm thấy kỳ thi!");
            router.push('/dashboard');
        }
    };
    fetchExam();
  }, [id, router]);

  // 2. Xử lý Join (Từ Lobby)
  const handleJoin = async (accessCode: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
        const res = await api.post(`/exams/${id}/join`, {
            userId: user.id,
            accessCode: accessCode
        });

        // Backend trả về: { connectionToken: "...", vm: { username: "...", ip: "..." } }
        if (res.data.connectionToken) {
            setToken(res.data.connectionToken);
            
            // LƯU THÔNG TIN MÁY ẢO ĐỂ HIỂN THỊ
            // Ưu tiên hiển thị Username của máy ảo (thường là định danh máy trong lab)
            // Nếu không có username thì fallback về IP
            const vmName = res.data.vm?.username || res.data.vm?.ip || "Unknown VM";
            setVmInfo({ name: vmName, ip: res.data.vm?.ip });

            // Yêu cầu Fullscreen ngay lập tức
            try {
                await document.documentElement.requestFullscreen();
            } catch (e) { console.log("Fullscreen denied"); }
        }
    } catch (err: any) {
        setErrorMsg(err.response?.data?.message || "Lỗi kết nối máy chủ thi.");
    } finally {
        setLoading(false);
    }
  };

  // 3. Xử lý Exit (Từ Machine)
  const handleExit = async () => {
      if (!confirm("Bạn có chắc chắn muốn thoát? Máy ảo sẽ bị tắt.")) return;
      try {
          await api.post('/exams/leave', { userId: user.id });
          if (document.fullscreenElement) document.exitFullscreen();
          router.push('/dashboard');
      } catch (err) { console.error(err); }
  };

  if (!isReady) return <div className="h-screen bg-gray-900 text-white flex items-center justify-center">Đang tải dữ liệu thi...</div>;

  // --- LOGIC ĐIỀU HƯỚNG HIỂN THỊ ---
  
  // Nếu có Token -> Render Màn hình Máy ảo (ExamMachine)
  if (token) {
      return (
          <ExamMachine
            examName={exam.name}
            token={token}
            endTime={vdiEndTime}
            studentName={user?.fullName || user?.username || "Thí sinh"}
            vmName={vmInfo?.name || "Máy ảo Lab"}
            onExit={handleExit}
            examId={Number(id)}
            userId={user.id}
          />
      );
  }

  // Nếu chưa có Token -> Render Sảnh chờ (ExamLobby)
  return (
      <ExamLobby 
          exam={exam} 
          user={user} 
          onJoin={handleJoin} 
          loading={loading} 
          error={errorMsg} 
      />
  );
}
