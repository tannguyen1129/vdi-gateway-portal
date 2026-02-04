"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();

  const updateUser = () => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) setUser(JSON.parse(storedUser));
    else setUser(null);
  };

  useEffect(() => {
    setMounted(true);
    updateUser(); 
    const handleAuthChange = () => updateUser();
    window.addEventListener('auth-change', handleAuthChange);
    window.addEventListener('storage', handleAuthChange); 
    return () => {
      window.removeEventListener('auth-change', handleAuthChange);
      window.removeEventListener('storage', handleAuthChange);
    };
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const handleLogout = () => {
    localStorage.removeItem('user');
    window.dispatchEvent(new Event('auth-change')); 
    router.push('/login');
  };

  const isStudentExamPage = pathname.includes('/exam') && !pathname.startsWith('/admin');
  const isVdiPage = pathname.includes('/vdi');
  if (isStudentExamPage || isVdiPage) return null;
  if (!mounted) return <div className="h-20 bg-white"></div>;

  // --- MENU DATA ---
  const adminMenu = [
    { name: 'Trang chủ', href: '/admin' },
    { name: 'Kỳ thi', href: '/admin/exams' },
    { name: 'Giám sát', href: '/admin/monitor' },
    { name: 'Sinh viên', href: '/admin/students' },
    { name: 'Máy ảo', href: '/admin/vms' },
  ];

  const studentMenu = [
    { name: 'Trang chủ', href: '/' },
    { name: 'Kỳ thi', href: '/dashboard' },
    { name: 'Giới thiệu', href: '/#about' },
    { name: 'Hướng dẫn', href: '/#guide' },
  ];

  const guestMenu = [
    { name: 'Trang chủ', href: '/' },
    { name: 'Giới thiệu', href: '/#about' },
    { name: 'Hướng dẫn', href: '/#guide' },
  ];

  let currentMenu = guestMenu;
  if (user) {
      const role = user.role ? user.role.toUpperCase() : ''; 
      if (role === 'ADMIN') currentMenu = adminMenu;
      else if (role === 'STUDENT') currentMenu = studentMenu;
  }

  return (
    // [THAY ĐỔI] Nền trắng (bg-white), chữ đen (text-gray-800), shadow nhẹ
    <nav className="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-40 shadow-sm transition-colors duration-300">
      <div className="container mx-auto px-4 md:px-6 h-20 flex justify-between items-center">
        
        {/* --- [1] LOGO & BRAND (BÊN TRÁI) --- */}
        <Link href="/" className="flex items-center gap-3 group hover:opacity-90 transition select-none">
             {/* Logo SOT Xanh */}
             <img 
                src="/sot-xanh.png" 
                alt="SOT Logo" 
                className="h-10 w-auto md:h-12 object-contain"
                onError={(e) => { e.currentTarget.style.display = 'none'; }} 
             />
             
             {/* Logo Chữ SOT VDI (Ảnh) */}
             <img 
                src="/sot-vdi.png" 
                alt="SOT VDI" 
                className="h-8 w-auto md:h-10 object-contain mt-1"
                onError={(e) => { 
                    // Fallback: Nếu ảnh lỗi thì hiện chữ
                    e.currentTarget.style.display = 'none'; 
                    const span = document.createElement('span');
                    span.innerText = 'SOT VDI GATEWAYS';
                    span.className = 'font-bold text-blue-800 text-xl';
                    e.currentTarget.parentElement?.appendChild(span);
                }} 
             />
        </Link>

        {/* --- [2] DESKTOP MENU --- */}
        <div className="hidden lg:flex items-center space-x-8">
            {currentMenu.map((item) => (
                <Link 
                    key={item.name} 
                    href={item.href}
                    className={`text-sm font-bold uppercase tracking-wide transition-all duration-200 relative py-2
                        ${pathname === item.href 
                            ? 'text-blue-700 after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-blue-600' 
                            : 'text-gray-500 hover:text-blue-600 hover:-translate-y-0.5'}`}
                >
                    {item.name}
                </Link>
            ))}
        </div>

        {/* --- [3] USER ACTIONS --- */}
        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-4">
              <div className="hidden md:block text-right border-r border-gray-200 pr-4">
                <p className="text-gray-800 font-bold text-sm leading-tight truncate max-w-[150px]">
                  {user.fullName || user.username}
                </p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${user.role === 'ADMIN' ? 'bg-red-100 text-red-600 border border-red-200' : 'bg-blue-100 text-blue-600 border border-blue-200'}`}>
                  {user.role === 'ADMIN' ? 'ADMIN' : 'STUDENT'}
                </span>
              </div>
              
              <button 
                onClick={handleLogout}
                className="hidden md:block bg-gray-100 hover:bg-red-50 text-gray-600 hover:text-red-600 px-4 py-2 rounded-lg text-sm font-bold border border-gray-200 transition"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            pathname !== '/login' && (
              <Link 
                href="/login" 
                className="hidden md:block bg-blue-600 hover:bg-blue-700 text-white px-6 py-2.5 rounded-lg font-bold transition shadow-lg shadow-blue-200 text-sm"
              >
                Đăng nhập
              </Link>
            )
          )}

          {/* Hamburger Button (Màu tối cho nền trắng) */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
          >
            {isMobileMenuOpen ? (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
               </svg>
            ) : (
               <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
               </svg>
            )}
          </button>
        </div>
      </div>

      {/* --- [4] MOBILE MENU --- */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-white border-b border-gray-200 shadow-xl animate-slide-in-top absolute w-full left-0 top-20">
           <div className="px-4 pt-2 pb-6 space-y-2">
              {user && (
                 <div className="flex items-center gap-3 px-3 py-3 mb-2 bg-gray-50 rounded-lg border border-gray-200">
                    <div className={`w-2 h-10 rounded ${user.role === 'ADMIN' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                    <div>
                       <p className="font-bold text-gray-800">{user.fullName}</p>
                       <p className="text-xs text-gray-500 uppercase">{user.role}</p>
                    </div>
                 </div>
              )}

              {currentMenu.map((item) => (
                 <Link 
                    key={item.name} 
                    href={item.href}
                    className={`block px-3 py-3 rounded-lg text-base font-bold transition 
                        ${pathname === item.href ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'}`}
                 >
                    {item.name}
                 </Link>
              ))}

              <div className="pt-4 mt-4 border-t border-gray-100">
                 {user ? (
                    <button 
                       onClick={handleLogout} 
                       className="w-full text-center bg-red-50 hover:bg-red-100 text-red-600 py-3 rounded-lg font-bold transition"
                    >
                       Đăng xuất
                    </button>
                 ) : (
                    <Link href="/login" className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-bold transition">
                       Đăng nhập
                    </Link>
                 )}
              </div>
           </div>
        </div>
      )}
    </nav>
  );
}