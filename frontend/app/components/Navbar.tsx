"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

export default function Navbar() {
  const [user, setUser] = useState<any>(null);
  const [mounted, setMounted] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false); // State cho Mobile Menu
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

  // Đóng mobile menu khi chuyển trang
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
  if (!mounted) return <div className="h-20 bg-gray-900"></div>;

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
    <nav className="bg-gray-900/95 backdrop-blur-md border-b border-gray-800 sticky top-0 z-40 shadow-xl text-white">
      <div className="container mx-auto px-4 md:px-6 h-20 flex justify-between items-center">
        
        {/* --- [1] LOGO & BRAND (RESPONSIVE) --- */}
        <Link href="/" className="flex items-center gap-2 md:gap-3 group hover:opacity-90 transition select-none">
             {/* Ảnh Logo: Nhỏ trên mobile (h-8), Lớn trên PC (h-11) */}
             <img 
                src="/logosot.png" 
                alt="SOT Logo" 
                className="h-9 w-auto md:h-11 object-contain drop-shadow-[0_0_8px_rgba(59,130,246,0.5)]"
                onError={(e) => { e.currentTarget.style.display = 'none'; }} 
             />
             
             {/* Tên Hệ thống: Tự động scale font theo màn hình */}
             <div className="flex items-baseline gap-1.5 md:gap-2 font-extrabold uppercase tracking-tight md:tracking-wider leading-none">
                {/* SOT VDI: Màu Gradient nổi bật */}
                <span className="text-lg md:text-2xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-300 filter drop-shadow-sm">
                  SOT VDI
                </span>
                {/* GATEWAYS: Màu trắng xám, giữ cân đối */}
                <span className="text-sm md:text-xl text-gray-300 group-hover:text-blue-200 transition-colors">
                  GATEWAYS
                </span>
             </div>
        </Link>

        {/* --- [2] DESKTOP MENU (Hidden on Mobile) --- */}
        <div className="hidden lg:flex items-center space-x-8">
            {currentMenu.map((item) => (
                <Link 
                    key={item.name} 
                    href={item.href}
                    className={`text-sm font-semibold transition-all duration-200 relative py-2 uppercase tracking-wide
                        ${pathname === item.href 
                            ? 'text-blue-400 after:content-[""] after:absolute after:bottom-0 after:left-0 after:w-full after:h-0.5 after:bg-blue-400 after:shadow-[0_0_8px_rgba(59,130,246,0.8)]' 
                            : 'text-gray-400 hover:text-white hover:-translate-y-0.5'}`}
                >
                    {item.name}
                </Link>
            ))}
        </div>

        {/* --- [3] USER ACTIONS & MOBILE TOGGLE --- */}
        <div className="flex items-center gap-3">
          {/* User Info (Chỉ hiện tên trên màn hình lớn) */}
          {user ? (
            <div className="flex items-center gap-4">
              <div className="hidden md:block text-right border-r border-gray-700 pr-4">
                <p className="text-white font-bold text-sm leading-tight truncate max-w-[150px]">
                  {user.fullName || user.username}
                </p>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block mt-0.5 ${user.role === 'ADMIN' ? 'bg-red-900/40 text-red-400 border border-red-500/30' : 'bg-blue-900/40 text-blue-400 border border-blue-500/30'}`}>
                  {user.role === 'ADMIN' ? 'ADMIN' : 'STUDENT'}
                </span>
              </div>
              
              <button 
                onClick={handleLogout}
                className="hidden md:block bg-gray-800 hover:bg-red-600/80 text-gray-300 hover:text-white px-4 py-2 rounded-lg text-sm font-medium border border-gray-700 transition"
              >
                Đăng xuất
              </button>
            </div>
          ) : (
            pathname !== '/login' && (
              <Link 
                href="/login" 
                className="hidden md:block bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white px-5 py-2 rounded-lg font-bold transition shadow-lg shadow-blue-900/20 text-sm"
              >
                Đăng nhập
              </Link>
            )
          )}

          {/* --- HAMBURGER BUTTON (MOBILE ONLY) --- */}
          <button 
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="lg:hidden p-2 text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition"
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

      {/* --- [4] MOBILE MENU DROPDOWN --- */}
      {isMobileMenuOpen && (
        <div className="lg:hidden bg-gray-900 border-b border-gray-800 animate-slide-in-top">
           <div className="px-4 pt-2 pb-6 space-y-2">
              {/* User Info trên Mobile */}
              {user && (
                 <div className="flex items-center gap-3 px-3 py-3 mb-2 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div className={`w-2 h-10 rounded ${user.role === 'ADMIN' ? 'bg-red-500' : 'bg-blue-500'}`}></div>
                    <div>
                       <p className="font-bold text-white">{user.fullName}</p>
                       <p className="text-xs text-gray-400 uppercase">{user.role}</p>
                    </div>
                 </div>
              )}

              {/* Menu Links */}
              {currentMenu.map((item) => (
                 <Link 
                    key={item.name} 
                    href={item.href}
                    className={`block px-3 py-3 rounded-lg text-base font-medium transition 
                        ${pathname === item.href ? 'bg-blue-900/30 text-blue-400 border border-blue-500/20' : 'text-gray-300 hover:bg-gray-800 hover:text-white'}`}
                 >
                    {item.name}
                 </Link>
              ))}

              {/* Action Buttons */}
              <div className="pt-4 mt-4 border-t border-gray-800">
                 {user ? (
                    <button 
                       onClick={handleLogout} 
                       className="w-full text-center bg-red-600/20 hover:bg-red-600/40 text-red-400 border border-red-500/30 py-3 rounded-lg font-bold transition"
                    >
                       Đăng xuất hệ thống
                    </button>
                 ) : (
                    <Link href="/login" className="block w-full text-center bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold transition">
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