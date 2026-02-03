import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const useExamSocket = (examId: number, userId: number, fullName: string) => {
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!examId || !userId) return;

        // 1. Lấy URL từ biến môi trường
        let url = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        
        // 2. Xóa dấu "/" ở cuối nếu có (để tránh lỗi //socket.io)
        if (url.endsWith('/')) {
            url = url.slice(0, -1);
        }

        console.log("🔌 Connecting to Socket URL:", url); // Log để kiểm tra xem nó nhận IP nào

        socketRef.current = io(url, {
            transports: ['websocket'],
            reconnectionAttempts: 5,
        });

        socketRef.current.on('connect', () => {
            console.log("🟢 Connected to Monitor System ID:", socketRef.current?.id);
            socketRef.current?.emit('join_exam_room', { examId, userId, fullName });
        });

        return () => {
            socketRef.current?.disconnect();
        };
    }, [examId, userId, fullName]);

    // Hàm báo cáo vi phạm
    const reportViolation = (type: string) => {
        if (socketRef.current) {
            console.log("🚨 Reporting violation:", type);
            socketRef.current.emit('report_violation', {
                examId,
                userId,
                violation: type
            });
        }
    };

    return { reportViolation };
};