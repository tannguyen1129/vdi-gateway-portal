import React from 'react';

export default function Footer() {
  return (
    <footer className="bg-gray-950 border-t border-gray-800 text-gray-300 py-10 mt-auto relative overflow-hidden">
      
      {/* Hiệu ứng nền mờ (Glow effect) */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-1 bg-gradient-to-r from-transparent via-blue-500/50 to-transparent blur-sm"></div>

      <div className="container mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-center gap-8">
          
          {/* === CỘT 1: LOGO & THƯƠNG HIỆU === */}
          <div className="flex flex-col items-center md:items-start gap-3">
             <div className="flex items-center gap-3">
                <img 
                    src="/logosot.png" 
                    alt="SOT Logo" 
                    className="h-12 w-auto object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.3)] grayscale hover:grayscale-0 transition duration-500"
                />
                <div className="flex flex-col">
                   <span className="font-extrabold text-lg tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-cyan-300 uppercase">
                      SOT VDI
                   </span>
                   <span className="text-[10px] font-bold text-gray-500 tracking-[0.3em] uppercase">
                      GATEWAYS
                   </span>
                </div>
             </div>
             <p className="text-xs text-gray-500 max-w-xs text-center md:text-left mt-2">
                Nền tảng cung cấp môi trường thực hành máy ảo hiệu năng cao phục vụ đào tạo và thi cử.
             </p>
          </div>

          {/* === CỘT 2: ĐỘI NGŨ PHÁT TRIỂN (CREDIT) === */}
          <div className="text-center md:text-right">
             <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-3 border-b border-gray-800 inline-block pb-1">
                Đơn vị phát triển
             </h3>
             <div className="text-sm text-gray-400 space-y-1 leading-relaxed">
                <p>
                   Hệ thống được phát triển bởi đội ngũ <span className="text-blue-400 font-bold hover:text-blue-300 transition cursor-default">TechGen Team</span>
                </p>
                <p>
                   thuộc <span className="text-cyan-400 font-bold hover:text-cyan-300 transition cursor-default">Câu lạc bộ Lập trình ứng dụng (APC)</span>
                </p>
                <p className="text-gray-500 font-medium">
                   Khoa Công Nghệ
                </p>
             </div>
          </div>

        </div>

        {/* === BOTTOM: COPYRIGHT === */}
        <div className="mt-10 pt-6 border-t border-gray-900 flex flex-col md:flex-row justify-between items-center text-xs text-gray-600 gap-4">
           <p>&copy; {new Date().getFullYear()} School of Technology VDI Gateways. All rights reserved. </p>
           <div className="flex gap-6">
              <span className="hover:text-blue-500 cursor-pointer transition">Điều khoản sử dụng</span>
              <span className="hover:text-blue-500 cursor-pointer transition">Chính sách bảo mật</span>
              <span className="hover:text-blue-500 cursor-pointer transition">Hỗ trợ kỹ thuật</span>
           </div>
        </div>
      </div>
    </footer>
  );
}