"use client";
import React, { useEffect, useRef, useState } from 'react';
// Import thư viện chuẩn từ NPM
import Guacamole from 'guacamole-common-js';

interface GuacamoleDisplayProps {
    token: string | null;
}

export default function GuacamoleDisplay({ token }: GuacamoleDisplayProps) {
    const displayRef = useRef<HTMLDivElement>(null);
    const clientRef = useRef<any>(null); 
    const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Quản lý timeout kết nối lại
    const [status, setStatus] = useState("Initializing...");

    useEffect(() => {
        // Nếu chưa có token thì chưa chạy
        if (!token) return;

        // Hàm kết nối chính (Được gói lại để gọi đệ quy khi cần reconnect)
        const connectVDI = () => {
            // 1. Dọn dẹp kết nối cũ nếu có
            if (clientRef.current) {
                clientRef.current.disconnect();
            }

            try {
                setStatus("Connecting...");

                // 2. Tạo Tunnel WebSocket
                const tunnel = new Guacamole.WebSocketTunnel(`ws://${window.location.hostname}:3000/guaclite`);
                
                const client = new Guacamole.Client(tunnel);
                clientRef.current = client;

                // 3. Xử lý lỗi (Tự động thử lại sau 3s)
                client.onerror = (e: any) => {
                    console.error("Guac Client Error:", e);
                    setStatus("Connection Error. Retrying in 3s...");
                    
                    // Xóa timeout cũ nếu có
                    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
                    // Đặt lịch kết nối lại
                    reconnectTimeoutRef.current = setTimeout(connectVDI, 3000);
                };
                
                // 4. Lắng nghe trạng thái kết nối
                tunnel.onstatechange = (s: number) => {
                    const states = ["CONNECTING", "CONNECTED", "CLOSING", "DISCONNECTED"];
                    setStatus(states[s] || `UNKNOWN (${s})`);

                    // Nếu bị ngắt kết nối (State = 3) -> Tự động thử lại sau 2s
                    if (s === 3) {
                         console.warn("Disconnected form Server. Attempting reconnect...");
                         if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
                         reconnectTimeoutRef.current = setTimeout(connectVDI, 2000);
                    }
                };

                // 5. Gắn màn hình máy ảo vào thẻ DIV
                const displayEl = client.getDisplay().getElement();
                if (displayRef.current) {
                    displayRef.current.innerHTML = ''; // Xóa màn hình cũ
                    displayRef.current.appendChild(displayEl);
                }

                // 6. Gửi lệnh kết nối với Token
                client.connect("token=" + token); 

                // ==================================================
                // XỬ LÝ SỰ KIỆN CHUỘT & BÀN PHÍM (Fix lỗi TypeScript)
                // ==================================================
                
                // Ép kiểu 'as any' để tránh lỗi đỏ TS
                const mouse = new Guacamole.Mouse(displayEl) as any;

                // Chặn menu chuột phải của trình duyệt để trải nghiệm giống Native app
                displayEl.oncontextmenu = (e: any) => { e.preventDefault(); return false; };

                // Gửi sự kiện chuột
                mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (s: any) => {
                    // Chỉ gửi khi Client đang kết nối
                    if (clientRef.current) clientRef.current.sendMouseState(s);
                };

                // Gửi sự kiện bàn phím (Gắn vào document để bắt phím toàn trang)
                const kbd = new Guacamole.Keyboard(document) as any;
                kbd.onkeydown = (k: any) => clientRef.current?.sendKeyEvent(1, k);
                kbd.onkeyup = (k: any) => clientRef.current?.sendKeyEvent(0, k);

            } catch (err: any) { 
                console.error("Exception in connectVDI:", err);
                setStatus("Client Exception. Retrying...");
                reconnectTimeoutRef.current = setTimeout(connectVDI, 5000);
            }
        };
        
        // Gọi hàm kết nối lần đầu
        connectVDI();

        // Xử lý Resize cửa sổ
        const handleResize = () => {
            if (clientRef.current) {
                clientRef.current.sendSize(window.innerWidth, window.innerHeight);
            }
        };
        window.addEventListener('resize', handleResize);

        // CLEANUP (Chạy khi component bị hủy hoặc token thay đổi)
        return () => { 
            console.log("Cleaning up Guacamole connection...");
            if(clientRef.current) {
                clientRef.current.disconnect();
            }
            if (reconnectTimeoutRef.current) {
                clearTimeout(reconnectTimeoutRef.current);
            }
            window.removeEventListener('resize', handleResize);
        };
    }, [token]);

    return (
        <div className="w-full h-full bg-black flex flex-col relative overflow-hidden">
            {/* Thanh trạng thái nhỏ góc màn hình (Debug) */}
            <div className={`absolute top-0 right-0 text-white text-xs p-2 z-50 backdrop-blur transition-opacity duration-500 ${status === 'CONNECTED' ? 'opacity-0 hover:opacity-100' : 'bg-blue-900/80'}`}>
                STATUS: {status}
            </div>
            
            {/* Vùng hiển thị máy ảo */}
            <div ref={displayRef} className="w-full h-full cursor-none outline-none" />
        </div>
    );
}