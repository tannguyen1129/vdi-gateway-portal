"use client";

import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800 text-gray-300 py-10 mt-auto relative overflow-hidden">
      
      {/* Hiệu ứng nền mờ (Glow effect) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-gradient-to-r from-transparent via-blue-500/40 to-transparent blur-sm"></div>

      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
          
          {/* === CỘT 1: LOGO THƯƠNG HIỆU === */}
          <div className="flex flex-col items-center md:items-start gap-4">
             <div className="flex items-center gap-4">
                {/* Logo SOT Xanh - Hiển thị nguyên màu */}
                <img 
                    src="/logosot.png" 
                    alt="SOT Logo" 
                    className="h-14 w-auto object-contain drop-shadow-[0_0_10px_rgba(59,130,246,0.2)]"
                    onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                />
                
                {/* Đường gạch ngăn cách */}
                <div className="w-px h-10 bg-gray-700"></div>

                {/* Logo VDI Trắng - Mới thêm vào */}
                <img 
                    src="/sot-vdi-trang.png" 
                    alt="SOT VDI GATEWAYS" 
                    className="h-10 w-auto object-contain"
                    onError={(e) => { 
                        // Fallback nếu ảnh lỗi thì hiện chữ
                        e.currentTarget.style.display = 'none'; 
                    }} 
                />
             </div>
          </div>

          {/* === CỘT 2: THÔNG TIN MÔ TẢ (CANH GIỮA) === */}
          <div className="text-center space-y-2">
             <p className="font-bold text-white tracking-wide uppercase text-sm">
                Hệ thống thi thực hành trực tuyến
             </p>
             <p className="text-xs text-gray-500 max-w-xs mx-auto leading-relaxed">
                Cung cấp môi trường Lab ảo hóa hiệu năng cao, bảo mật và công bằng cho sinh viên Khoa Công Nghệ.
             </p>
             <p className="text-[10px] text-gray-600 mt-2">
                &copy; {new Date().getFullYear()} SOT VDI Gateways. All rights reserved.
             </p>
          </div>

          {/* === CỘT 3: ĐỘI NGŨ PHÁT TRIỂN (CANH PHẢI) === */}
          <div className="flex flex-col items-center md:items-end text-center md:text-right">
             <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-2">
                Đơn vị phát triển
             </h3>
             <div className="text-sm space-y-0.5">
                <p className="text-gray-300">
                   <span className="text-blue-400 font-bold">TechGen Team</span>
                </p>
                <p className="text-gray-400 text-xs">
                   Câu lạc bộ Lập trình ứng dụng (APC)
                </p>
                <p className="text-gray-500 text-[10px] uppercase mt-1 font-medium">
                   Khoa Công Nghệ
                </p>
             </div>
          </div>

        </div>
      </div>
    </footer>
  );
}