"use client";
import React, { useEffect, useRef, useState } from 'react';
import Guacamole from 'guacamole-common-js';

interface GuacamoleDisplayProps {
    token: string | null;
}

export default function GuacamoleDisplay({ token }: GuacamoleDisplayProps) {
    const displayRef = useRef<HTMLDivElement>(null);
    const clientRef = useRef<any>(null); 
    
    // [FIX] Cờ hiệu để đảm bảo chỉ chạy 1 lần duy nhất
    const hasConnected = useRef(false);
    
    const [status, setStatus] = useState("Initializing...");

    useEffect(() => {
        if (!token) return;
        
        // Nếu đã từng chạy rồi thì dừng ngay lập tức
        if (hasConnected.current) return;
        hasConnected.current = true;

        const connectVDI = () => {
            try {
                setStatus("Connecting...");
                
                // WebSocket Tunnel
                const tunnel = new Guacamole.WebSocketTunnel(`ws://${window.location.hostname}:3000/guaclite`);
                const client = new Guacamole.Client(tunnel);
                clientRef.current = client;

                client.onerror = (e: any) => {
                    console.error("Guac Error:", e);
                    setStatus(`Error: ${e.message || 'Connection failed'}`);
                };
                
                tunnel.onstatechange = (s: number) => {
                    const states = ["CONNECTING", "CONNECTED", "CLOSING", "DISCONNECTED"];
                    setStatus(states[s] || `UNKNOWN (${s})`);
                };

                const displayEl = client.getDisplay().getElement();
                // [FIX] Thêm sự kiện click để focus vào máy ảo (để gõ phím được ngay)
                displayEl.addEventListener('click', () => {
                    displayEl.focus();
                });

                if (displayRef.current) {
                    displayRef.current.innerHTML = ''; 
                    displayRef.current.appendChild(displayEl);
                }

                client.connect("token=" + token); 

                // Mouse & Keyboard
                const mouse = new Guacamole.Mouse(displayEl) as any;
                // Chặn menu chuột phải
                displayEl.oncontextmenu = (e: any) => { e.preventDefault(); return false; };

                mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (s: any) => {
                    if (clientRef.current) clientRef.current.sendMouseState(s);
                };

                const kbd = new Guacamole.Keyboard(document) as any;
                kbd.onkeydown = (k: any) => clientRef.current?.sendKeyEvent(1, k);
                kbd.onkeyup = (k: any) => clientRef.current?.sendKeyEvent(0, k);

            } catch (err: any) { 
                setStatus("Client Exception");
            }
        };
        
        connectVDI();

        // [QUAN TRỌNG] Cleanup function để trống trong môi trường Dev
        // Để tránh React Strict Mode ngắt kết nối khi re-render
        return () => { 
            // if(clientRef.current) clientRef.current.disconnect(); 
        };
    }, [token]);

    return (
        <div className="w-full h-full bg-black flex items-center justify-center relative overflow-hidden">
            {status !== 'CONNECTED' && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white z-50">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                        <p>{status}</p>
                        <p className="text-xs text-gray-400 mt-2">Vui lòng đợi tải màn hình...</p>
                    </div>
                </div>
            )}
            
            {/* Khung hiển thị */}
            <div ref={displayRef} className="shadow-2xl bg-black" />
        </div>
    );
}