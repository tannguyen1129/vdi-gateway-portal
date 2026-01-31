// frontend/app/components/GuacamoleDisplay.tsx
"use client";
import React, { useEffect, useRef, useState } from 'react';
import Guacamole from 'guacamole-common-js';

interface GuacamoleDisplayProps {
    token: string | null;
}

export default function GuacamoleDisplay({ token }: GuacamoleDisplayProps) {
    const displayRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null); // Ref để đo kích thước khung
    const clientRef = useRef<any>(null); 
    const hasConnected = useRef(false);
    
    const [status, setStatus] = useState("Initializing...");

    useEffect(() => {
        if (!token || hasConnected.current) return;
        hasConnected.current = true;

        const connectVDI = () => {
            try {
                setStatus("Connecting...");
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
                displayEl.addEventListener('click', () => { displayEl.focus(); });
                
                if (displayRef.current) {
                    displayRef.current.innerHTML = ''; 
                    displayRef.current.appendChild(displayEl);
                }

                // --- [ĐOẠN FIX QUAN TRỌNG] ---
                // 1. Lấy kích thước thật của khung chứa (container)
                let width = 1024; 
                let height = 768;
                if (containerRef.current) {
                    width = containerRef.current.clientWidth;
                    height = containerRef.current.clientHeight;
                }

                // 2. Gửi width & height lên Server
                // (Code cũ của bạn thiếu đoạn này nên màn hình mới bị bé tí)
                client.connect(`token=${token}&width=${width}&height=${height}`); 
                // -----------------------------

                const mouse = new Guacamole.Mouse(displayEl) as any;
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

        // 3. Tự động resize khi người dùng kéo cửa sổ trình duyệt
        const handleResize = () => {
            if (clientRef.current && containerRef.current) {
                const w = containerRef.current.clientWidth;
                const h = containerRef.current.clientHeight;
                clientRef.current.sendSize(w, h);
            }
        };
        window.addEventListener('resize', handleResize);

        return () => { 
            window.removeEventListener('resize', handleResize);
            if(clientRef.current) clientRef.current.disconnect();
        };
    }, [token]);

    return (
        // Gắn ref={containerRef} để đo kích thước
        <div ref={containerRef} className="w-full h-full bg-black flex items-center justify-center relative overflow-hidden">
            {status !== 'CONNECTED' && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white z-50">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                        <p>{status}</p>
                    </div>
                </div>
            )}
            <div ref={displayRef} className="shadow-2xl bg-black" />
        </div>
    );
}