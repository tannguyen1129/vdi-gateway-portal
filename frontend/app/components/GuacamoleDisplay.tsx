"use client";

import React, { useEffect, useRef, useState } from 'react';
import Script from 'next/script'; 

// Khai báo để TS không báo lỗi
declare global {
  interface Window {
    Guacamole: any;
  }
}

// Input nhận vào config thay vì token
interface GuacamoleDisplayProps {
    connectionConfig: {
        ip: string;
        username: string;
        password: string;
        port: number;
        width?: number;
        height?: number;
    } | null;
}

export default function GuacamoleDisplay({ connectionConfig }: GuacamoleDisplayProps) {
    const displayRef = useRef<HTMLDivElement>(null);
    const clientRef = useRef<any>(null);
    const tunnelRef = useRef<any>(null);
    
    const [status, setStatus] = useState("Loading Library...");
    const [libLoaded, setLibLoaded] = useState(false);

    useEffect(() => {
        // Nếu chưa load thư viện hoặc chưa có config thì thôi
        if (!libLoaded || !connectionConfig) return;
        
        if (typeof window.Guacamole === 'undefined') {
             setStatus("Library Error. Retrying...");
             return;
        }

        const connectVDI = async () => {
            try {
                setStatus("Connecting Gateway...");

                // --- 1. TẠO TUNNEL ---
                // Lưu ý: Port này phải khớp với Port chạy guacamole-lite (thường là 8080 hoặc 3000)
                // Nếu backend NestJS chạy port 3000 và tích hợp guacd thì để 3000
                const tunnel = new window.Guacamole.WebSocketTunnel(`ws://${window.location.hostname}:8080`); 
                tunnelRef.current = tunnel;

                // --- 2. TẠO CLIENT ---
                const client = new window.Guacamole.Client(tunnel);
                clientRef.current = client;

                // Error Handling
                client.onerror = (err: any) => {
                    console.error("Client Error", err);
                    setStatus(`Client Error: ${err.message || err.code || 'Unknown'}`);
                };
                
                tunnel.onerror = (err: any) => {
                    console.error("Tunnel Error", err);
                    // setStatus(`Tunnel Error: ${err.message || 'Connection Refused'}`);
                };

                tunnel.onstatechange = (state: number) => {
                    // 0: CONNECTING, 1: OPEN, 2: CLOSING, 3: CLOSED
                    const states = ["CONNECTING", "CONNECTED", "CLOSING", "DISCONNECTED"];
                    setStatus(states[state] || `Status ${state}`);
                };

                // Display
                const displayEl = client.getDisplay().getElement();
                
                // CSS Reset
                displayEl.style.position = 'relative';
                displayEl.style.width = '100%';
                displayEl.style.height = '100%';
                displayEl.style.zIndex = '100';
                
                if (displayRef.current) {
                    displayRef.current.innerHTML = ''; 
                    displayRef.current.appendChild(displayEl);
                }

                // --- 3. KẾT NỐI (SỬA ĐOẠN NÀY) ---
                // Thay vì gửi token, ta gửi params trực tiếp
                const params = [
                    `hostname=${connectionConfig.ip}`,
                    `port=${connectionConfig.port || 3389}`,
                    `username=${connectionConfig.username}`,
                    `password=${connectionConfig.password}`,
                    `width=${displayRef.current?.offsetWidth || window.innerWidth}`,
                    `height=${displayRef.current?.offsetHeight || window.innerHeight}`,
                    `ignore-cert=true`,
                    `security=any`,
                    `scheme=rdp` 
                ];
                
                console.log("Connecting with params:", params.join('&')); // Debug xem params đúng chưa
                client.connect(params.join('&'));

                // Mouse
                const mouse = new window.Guacamole.Mouse(displayEl);
                mouse.onmousedown = mouse.onmouseup = mouse.onmousemove = (mouseState: any) => {
                    client.sendMouseState(mouseState);
                };

                // Keyboard
                const kbd = new window.Guacamole.Keyboard(document);
                kbd.onkeydown = (k:any) => client.sendKeyEvent(1, k);
                kbd.onkeyup = (k:any) => client.sendKeyEvent(0, k);

                // Keep-Alive
                const interval = setInterval(() => {
                    if (tunnel.state === 1) tunnel.sendMessage("nop");
                }, 5000);

                return () => clearInterval(interval);

            } catch (err: any) {
                console.error(err);
                setStatus("Fatal Error: " + err.message);
            }
        };

        connectVDI();

        return () => {
            if (clientRef.current) clientRef.current.disconnect();
        };

    }, [connectionConfig, libLoaded]);

    return (
        <div className="w-full h-full bg-black flex flex-col relative overflow-hidden">
            {/* Load thư viện từ CDN */}
            <Script 
                src="https://unpkg.com/guacamole-common-js@1.3.0/dist/guacamole-common.js"
                strategy="afterInteractive" 
                onLoad={() => {
                    console.log("Guacamole Lib Loaded!");
                    setLibLoaded(true);
                }}
            />

            {/* Thanh trạng thái DEBUG (Ẩn đi nếu muốn) */}
            <div className="absolute top-0 w-full bg-blue-900/80 text-white text-xs p-1 z-50 flex justify-between px-4 font-mono pointer-events-none">
                <span>STATUS: {status}</span>
                <span>TARGET: {connectionConfig?.ip}</span>
            </div>
            
            {/* Màn hình VDI */}
            <div ref={displayRef} className="w-full h-full bg-black flex items-center justify-center cursor-none" />
        </div>
    );
}