"use client";
import { useState, useEffect } from 'react';
import GuacamoleDisplay from '../../../components/GuacamoleDisplay';
import { useExamSocket } from '../../../hooks/useExamSocket';

interface MachineProps {
  examName: string;
  token: string;
  endTime: string;
  studentName: string;
  vmName: string;
  onExit: () => void;
  examId: number;
  userId: number;
}

export default function ExamMachine({
  examName, token, endTime, studentName, vmName, onExit, examId, userId
}: MachineProps) {
  const { reportViolation } = useExamSocket(examId, userId, studentName);
    const [isTimeUp, setIsTimeUp] = useState(false);
    const [isExiting, setIsExiting] = useState(false);

    // 2. Callback xử lý khi Guacamole báo vi phạm
    // Hàm này sẽ được truyền xuống GuacamoleDisplay
    const handleViolationDetected = (violationType: string) => {
        // Gửi socket ngay lập tức
        reportViolation(violationType);
    };

    const handleTimeUp = () => setIsTimeUp(true);
    const handleExitClick = () => {
        setIsExiting(true);
        onExit();
    };

    return (
        <div className="fixed inset-0 bg-black flex flex-col z-50">
            {/* Header nhỏ hiển thị tên kỳ thi */}
            <div className="h-8 bg-[#1a1a1a] flex items-center justify-between px-4 border-b border-gray-700 select-none">
                <div className="flex items-center gap-2">
                    <span className="text-gray-400 text-xs">Kỳ thi:</span>
                    <span className="text-gray-200 text-xs font-bold uppercase">{examName}</span>
                </div>
            </div>

            {/* Phần hiển thị chính */}
            <div className="flex-1 relative bg-black">
                <GuacamoleDisplay 
                    token={token} 
                    endTime={endTime} 
                    onTimeUp={handleTimeUp}
                    studentName={studentName}
                    vmName={vmName}
                    onExit={handleExitClick}
                    onViolation={handleViolationDetected}
                    suppressViolation={isExiting}
                />
            </div>

            {/* Popup hết giờ */}
            {isTimeUp && (
                <div className="absolute inset-0 bg-black/90 z-[100] flex flex-col items-center justify-center text-white animate-bounce-in">
                    <h1 className="text-4xl font-bold text-red-500 mb-4">ĐÃ HẾT GIỜ LÀM BÀI</h1>
                    <button 
                        onClick={handleExitClick}
                        className="px-8 py-4 bg-red-600 hover:bg-red-700 rounded-lg text-xl font-bold shadow-2xl transition transform hover:scale-110"
                    >
                        NỘP BÀI NGAY
                    </button>
                </div>
            )}
        </div>
    );
}
