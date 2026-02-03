"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '../../utils/axios';

export default function MonitorListPage() {
    const [exams, setExams] = useState<any[]>([]);
    const router = useRouter();

    useEffect(() => {
        api.get('/exams').then(res => setExams(res.data));
    }, []);

    return (
        <div className="p-8">
            <h1 className="text-2xl font-bold mb-6">Chọn kỳ thi để giám sát (Real-time)</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {exams.map(exam => (
                    <div key={exam.id} className="bg-white p-6 rounded-lg shadow hover:shadow-lg transition border cursor-pointer"
                         onClick={() => router.push(`/admin/monitor/${exam.id}`)}>
                        <h2 className="font-bold text-xl mb-2 text-blue-600">{exam.name}</h2>
                        <p className="text-gray-500 text-sm">Bắt đầu: {new Date(exam.startTime).toLocaleString()}</p>
                        <button className="mt-4 w-full bg-gray-900 text-white py-2 rounded hover:bg-gray-800">
                            Vào phòng giám sát →
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}