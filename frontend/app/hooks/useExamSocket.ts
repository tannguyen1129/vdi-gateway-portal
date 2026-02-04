import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';

export const useExamSocket = (examId: number, userId: number, fullName: string) => {
    const socketRef = useRef<Socket | null>(null);

    useEffect(() => {
        if (!examId || !userId) return;

        // [FIX QUAN TRỌNG]
        // 1. Nếu đang ở trình duyệt, dùng chính domain hiện tại (Port 80)
        // 2. Bỏ hardcode Port 3000 đi
        let url = '';
        if (typeof window !== 'undefined') {
             url = window.location.origin; // Ví dụ: http://217.216.33.134
        }
        
        console.log("🔌 Connecting to Socket URL:", url);

        socketRef.current = io(url, {
            transports: ['websocket'],
            reconnectionAttempts: 5,
            // Nginx đã cấu hình location /socket.io/ nên không cần path custom
        });

        socketRef.current.on('connect', () => {
            console.log("🟢 Connected to Monitor System ID:", socketRef.current?.id);
            socketRef.current?.emit('join_exam_room', { examId, userId, fullName });
        });

        return () => {
            socketRef.current?.disconnect();
        };
    }, [examId, userId, fullName]);

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