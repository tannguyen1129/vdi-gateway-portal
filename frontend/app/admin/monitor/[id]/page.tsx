"use client";
import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import api from './../../../utils/axios';

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL || 'http://217.216.33.134:3000';

interface LogItem {
    id: number;
    type: 'INFO' | 'WARNING' | 'VIOLATION';
    action: string;
    details: string;
    createdAt: string;
    user: { fullName: string; username: string };
}

interface StudentStatus {
    userId: number;
    fullName: string;
    status: 'ONLINE' | 'OFFLINE'; // Trạng thái kết nối
    violationCount: number;       // Đếm số lần vi phạm
    lastAction: string;
}

export default function MonitorDetailPage() {
    const { id: examId } = useParams();
    const router = useRouter();
    const socketRef = useRef<Socket | null>(null);
    // Đã bỏ audioRef

    // State dữ liệu
    const [logs, setLogs] = useState<LogItem[]>([]);
    const [students, setStudents] = useState<Map<number, StudentStatus>>(new Map());
    const [examInfo, setExamInfo] = useState<any>(null);
    const [isConnected, setIsConnected] = useState(false);

    // 1. Fetch dữ liệu ban đầu
    useEffect(() => {
        const initData = async () => {
            try {
                // Lấy thông tin kỳ thi
                const examRes = await api.get(`/exams/${examId}`);
                setExamInfo(examRes.data);

                // Lấy lịch sử log & trạng thái
                const monitorRes = await api.get(`/monitor/${examId}/init`);
                
                setLogs(monitorRes.data.logs);

                // Convert list students thành Map để dễ update
                const stdMap = new Map<number, StudentStatus>();
                monitorRes.data.students.forEach((s: any) => {
                    stdMap.set(s.userId, {
                        userId: s.userId,
                        fullName: s.fullName,
                        status: 'OFFLINE', // Mặc định offline, đợi socket báo online
                        violationCount: s.lastStatus === 'VIOLATION' ? 1 : 0,
                        lastAction: s.lastAction
                    });
                });
                setStudents(stdMap);
            } catch (err) {
                console.error(err);
                alert("Lỗi tải dữ liệu giám sát");
            }
        };
        initData();
    }, [examId]);

    // 2. Kết nối Socket & Lắng nghe
    useEffect(() => {
        socketRef.current = io(SOCKET_URL, { transports: ['websocket'] });

        socketRef.current.on('connect', () => {
            setIsConnected(true);
            // Join phòng Admin
            socketRef.current?.emit('join_monitor_room', { examId: Number(examId) });
        });

        socketRef.current.on('disconnect', () => setIsConnected(false));

        // --- SỰ KIỆN: SINH VIÊN ONLINE/OFFLINE ---
        socketRef.current.on('student_status', (data: { userId: number, fullName: string, status: string }) => {
            setStudents(prev => {
                const newMap = new Map(prev);
                const current = newMap.get(data.userId) || { 
                    userId: data.userId, 
                    fullName: data.fullName, 
                    violationCount: 0, 
                    lastAction: '' 
                };
                
                newMap.set(data.userId, {
                    ...current,
                    status: data.status as 'ONLINE' | 'OFFLINE',
                    lastAction: data.status === 'ONLINE' ? 'JOINED' : 'DISCONNECTED'
                });
                return newMap;
            });

            // Thêm log nhẹ
            addLogLocal({
                type: 'INFO',
                action: data.status,
                details: `Sinh viên ${data.status === 'ONLINE' ? 'kết nối' : 'mất kết nối'}`,
                user: { fullName: data.fullName, username: '' },
                createdAt: new Date().toISOString()
            } as any);
        });

        // --- SỰ KIỆN: VI PHẠM (QUAN TRỌNG) ---
        socketRef.current.on('new_violation', (data: { userId: number, details: string, logId: number, timestamp: string }) => {
            // Không phát âm thanh nữa

            // 1. Cập nhật Grid Sinh viên (Tăng count vi phạm -> Đỏ lên)
            setStudents(prev => {
                const newMap = new Map(prev);
                const s = newMap.get(data.userId);
                if (s) {
                    newMap.set(data.userId, { ...s, violationCount: s.violationCount + 1, lastAction: 'VIOLATION' });
                }
                return newMap;
            });

            // 2. Đẩy vào Log List
            const studentName = students.get(data.userId)?.fullName || "Unknown";
            addLogLocal({
                id: data.logId,
                type: 'VIOLATION',
                action: 'CHEAT_DETECTED',
                details: data.details,
                createdAt: data.timestamp,
                user: { fullName: studentName, username: '' }
            });
        });

        return () => {
            socketRef.current?.disconnect();
        };
    }, [examId, students]);

    const addLogLocal = (log: LogItem) => {
        setLogs(prev => [log, ...prev]);
    };

    return (
        <div className="flex h-screen bg-gray-100 flex-col overflow-hidden">
            {/* Đã bỏ thẻ <audio> */}

            {/* Header */}
            <header className="h-14 bg-white border-b flex items-center justify-between px-6 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <button onClick={() => router.back()} className="text-gray-500 hover:text-black">← Quay lại</button>
                    <h1 className="font-bold text-lg text-gray-800">
                        Giám sát: <span className="text-blue-600">{examInfo?.name}</span>
                    </h1>
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${isConnected ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {isConnected ? 'LIVE SOCKET' : 'DISCONNECTED'}
                    </span>
                </div>
                <div className="flex gap-4 text-sm font-medium">
                    <div className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-full"></span> Online</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-3 bg-gray-400 rounded-full"></span> Offline</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-full"></span> Vi phạm</div>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden">
                {/* LEFT: Student Grid (Lưới sinh viên) */}
                <div className="flex-1 p-6 overflow-y-auto">
                    <h2 className="text-gray-500 font-bold mb-4 uppercase text-xs tracking-wider">Danh sách sinh viên ({students.size})</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
                        {Array.from(students.values()).map((s) => (
                            <div key={s.userId} className={`
                                relative p-4 rounded-xl border-2 shadow-sm transition-all duration-300
                                ${s.violationCount > 0 ? 'bg-red-50 border-red-500' : // Bỏ animate-pulse cho đỡ rối mắt
                                  s.status === 'ONLINE' ? 'bg-white border-green-500' : 'bg-gray-50 border-gray-300 opacity-70'}
                            `}>
                                <div className="flex justify-between items-start mb-2">
                                    <div className={`w-2 h-2 rounded-full ${s.status === 'ONLINE' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                                    {s.violationCount > 0 && (
                                        <span className="bg-red-600 text-white text-[10px] font-bold px-1.5 rounded-full">
                                            {s.violationCount} lỗi
                                        </span>
                                    )}
                                </div>
                                <h3 className="font-bold text-gray-800 text-sm truncate" title={s.fullName}>{s.fullName}</h3>
                                <p className="text-xs text-gray-500 mt-1 truncate">
                                    {s.violationCount > 0 ? '⚠️ VI PHẠM!' : s.lastAction || 'Chưa hoạt động'}
                                </p>
                            </div>
                        ))}
                        {students.size === 0 && <p className="text-gray-400 col-span-full text-center py-10">Chưa có sinh viên nào tham gia.</p>}
                    </div>
                </div>

                {/* RIGHT: Live Logs (Nhật ký Hacker) */}
                <div className="w-96 bg-gray-900 text-gray-300 border-l border-gray-700 flex flex-col font-mono text-xs">
                    <div className="p-4 border-b border-gray-700 bg-gray-800 font-bold text-white flex justify-between">
                        <span>LIVE LOGS</span>
                        <span className="animate-pulse text-green-400">● REC</span>
                    </div>
                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                        {logs.map((log, index) => (
                            <div key={index} className={`p-2 rounded border-l-2 mb-1 animate-slide-in 
                                ${log.type === 'VIOLATION' ? 'border-red-500 bg-red-900/20 text-red-300' : 
                                  log.type === 'WARNING' ? 'border-yellow-500 bg-yellow-900/20' : 'border-blue-500 bg-gray-800'}
                            `}>
                                <div className="flex justify-between opacity-50 mb-1">
                                    <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                                    <span>{log.action}</span>
                                </div>
                                <div className="font-bold text-white mb-0.5">{log.user?.fullName}</div>
                                <div className="leading-tight opacity-80">{log.details}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
