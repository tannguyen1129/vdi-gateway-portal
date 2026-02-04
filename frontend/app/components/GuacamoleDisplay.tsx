// frontend/app/components/GuacamoleDisplay.tsx
"use client";
import React, { useEffect, useRef, useState } from "react";
import Guacamole from "guacamole-common-js";
import { useKioskMode } from "../hooks/useKioskMode";

// --- CUSTOM TUNNEL CLASS ---
// Khắc phục lỗi "Invalid array length" khi mạng không ổn định
// bằng cách sử dụng Guacamole.Parser để stream dữ liệu thay vì parse từng message
class StableWebSocketTunnel extends Guacamole.Tunnel {
  private socket: WebSocket | null = null;
  // Dùng 'as any' để truy cập Parser vì type definition có thể thiếu
  private parser = new (Guacamole as any).Parser();

  constructor(private url: string) {
    super();
    // Khi Parser giải mã xong một lệnh, nó gọi oninstruction
    this.parser.oninstruction = (opcode: string, args: string[]) => {
      if (this.oninstruction) this.oninstruction(opcode, args);
    };
  }

  connect(_data?: string) {
    // Reset parser khi bắt đầu kết nối mới
    this.parser = new (Guacamole as any).Parser();
    this.parser.oninstruction = (opcode: string, args: string[]) => {
      if (this.oninstruction) this.oninstruction(opcode, args);
    };

    (this as any).setState(Guacamole.Tunnel.State.CONNECTING);
    
    this.socket = new WebSocket(this.url, "guacamole");

    this.socket.onopen = () => {
      (this as any).setState(Guacamole.Tunnel.State.OPEN);
    };

    this.socket.onmessage = (event) => {
      const handleText = (text: string) => {
        try {
          // Đẩy dữ liệu vào parser, nó sẽ tự ghép nối các chunk
          this.parser.receive(text);
        } catch (e) {
          if (this.onerror) {
            this.onerror(new (Guacamole as any).Status(
              (Guacamole as any).Status.Code.SERVER_ERROR,
              "Protocol parse error"
            ));
          }
        }
      };

      if (typeof event.data === "string") {
        handleText(event.data);
      } else if (event.data instanceof ArrayBuffer) {
        const text = new TextDecoder("utf-8").decode(new Uint8Array(event.data));
        handleText(text);
      } else if (event.data instanceof Blob) {
        event.data.text().then(handleText);
      }
    };

    this.socket.onclose = (event) => {
      (this as any).setState(Guacamole.Tunnel.State.CLOSED);
      // Chỉ báo lỗi nếu close code không bình thường (khác 1000)
      if (this.onerror && event.code !== 1000 && event.reason) {
        this.onerror(new (Guacamole as any).Status(event.code, event.reason));
      }
    };
    
    this.socket.onerror = (event) => {
       // WebSocket error thường không có detail, xử lý ở onclose
    };
  }

  disconnect() {
    if (this.socket && (this.socket.readyState === WebSocket.OPEN || this.socket.readyState === WebSocket.CONNECTING)) {
      this.socket.close();
    }
    (this as any).setState(Guacamole.Tunnel.State.CLOSED);
  }

  sendMessage(opcode: string, ...args: any[]) {
    if (!this.isConnected() || !this.socket) return;
    
    // Format lệnh theo giao thức Guacamole: length.content,length.content;
    let message = `${String(opcode).length}.${opcode}`;
    for (const arg of args) {
      const value = String(arg);
      message += `,${value.length}.${value}`;
    }
    message += ";";
    
    this.socket.send(message);
  }
}

interface GuacamoleDisplayProps {
  token: string | null;
  endTime?: string;
  onTimeUp?: () => void;
  studentName?: string;
  vmName?: string;
  onExit?: () => void;
  onViolation?: (type: string) => void;
  suppressViolation?: boolean;
}

export default function GuacamoleDisplay({ 
  token, 
  endTime, 
  onTimeUp, 
  studentName = "Thí sinh", 
  vmName = "VM-01",
  onExit,
  onViolation,
  suppressViolation = false
}: GuacamoleDisplayProps) {
  const displayRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<any>(null); // Guacamole.Client
  const tunnelRef = useRef<any>(null); // Guacamole.Tunnel

  // --- 1. LOGIC ĐẾM NGƯỢC ---
  const [timeLeftStr, setTimeLeftStr] = useState("--:--:--");
  const [isTimeUp, setIsTimeUp] = useState(false);
  const [isCriticalTime, setIsCriticalTime] = useState(false);

  useEffect(() => {
    if (!endTime) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const end = new Date(endTime).getTime();
      const distance = end - now;

      if (distance < 0) {
        clearInterval(interval);
        setTimeLeftStr("00:00:00");
        setIsTimeUp(true);
        if (onTimeUp) onTimeUp();
      } else {
        const h = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((distance % (1000 * 60)) / 1000);
        setTimeLeftStr(`${h}:${m < 10 ? '0'+m : m}:${s < 10 ? '0'+s : s}`);
        
        if (distance < 5 * 60 * 1000) setIsCriticalTime(true);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime, onTimeUp]);

  // --- 2. LOGIC KIOSK & STATUS ---
  const { setupKioskInput, enterExamMode, isLocked, isFullScreen, isTabActive } = useKioskMode(!isTimeUp);
  const [status, setStatus] = useState("INITIALIZING");
  const isConnected = status === "CONNECTED";

  // Phát hiện vi phạm
  useEffect(() => {
      if (suppressViolation) return;
      if (isConnected && !isTimeUp) {
          if (!isFullScreen) {
              onViolation && onViolation("EXIT_FULLSCREEN");
          }
          if (!isTabActive) {
              onViolation && onViolation("TAB_SWITCH");
          }
      }
  }, [isFullScreen, isTabActive, isConnected, isTimeUp, onViolation, suppressViolation]);

  const handleResume = () => {
      if (clientRef.current) {
          const displayEl = clientRef.current.getDisplay().getElement();
          enterExamMode(displayEl);
      }
  };

  // --- 3. GUACAMOLE CONNECTION ---
  useEffect(() => {
    if (!token) return;
    
    // Cleanup variables local scope để đảm bảo cleanup đúng instance
    let client: any = null;
    let tunnel: any = null;
    let cleanupInput: any = null;
    let resizeObserver: ResizeObserver | null = null;

    const connectVDI = () => {
      try {
        setStatus("CONNECTING");

        // --- XỬ LÝ URL DYNAMIC CHO VPS ---
        const resolveWsBase = () => {
          // Ưu tiên biến môi trường nếu có
          let base = (process.env.NEXT_PUBLIC_API_URL || '').trim();

          // [FIX QUAN TRỌNG]: Nếu không có biến môi trường, tự động lấy IP nhưng ÉP CỔNG 3000
          // Để kết nối thẳng vào Backend, tránh đi qua Next.js Proxy (Port 80) gây lỗi WebSocket
          if (!base && typeof window !== 'undefined') {
              const protocol = window.location.protocol; // http: hoặc https:
              const hostname = window.location.hostname; // 217.216.33.134
              
              // Ép cứng port 3000 để bypass Next.js
              base = `${protocol}//${hostname}:3000`;
          }

          // Chuẩn hóa URL
          base = base.replace(/\/+$/, ''); // Bỏ dấu / ở cuối
          if (base.endsWith('/api')) base = base.slice(0, -4);

          // Chuyển http -> ws, https -> wss
          if (base.startsWith('http://')) return `ws://${base.slice('http://'.length)}`;
          if (base.startsWith('https://')) return `wss://${base.slice('https://'.length)}`;
          
          // Trường hợp base là relative hoặc IP không protocol
          const wsProto = window.location.protocol === 'https:' ? 'wss' : 'ws';
          if (!base.startsWith('ws://') && !base.startsWith('wss://')) {
             return `${wsProto}://${base}`; // Lúc này base đã có port 3000
          }
          return base;
        };

        // Lấy kích thước khung hình hiện tại
        const w = containerRef.current?.clientWidth || window.innerWidth;
        const h = containerRef.current?.clientHeight || window.innerHeight;

        const query = new URLSearchParams({
          token: token,
          width: String(Math.floor(w)),
          height: String(Math.floor(h)),
          dpi: '96',
        });

        // URL cuối cùng: ws://[IP]/guaclite?token=...
        const wsUrl = `${resolveWsBase()}/guaclite?${query.toString()}`;
        console.log("🔌 Connecting to VDI via:", wsUrl);

        // Khởi tạo Tunnel & Client
        tunnel = new StableWebSocketTunnel(wsUrl);
        client = new Guacamole.Client(tunnel);
        
        // Lưu vào ref để dùng ở nơi khác (handleResume)
        clientRef.current = client;
        tunnelRef.current = tunnel;

        // --- XỬ LÝ RESIZE (SCALE) ---
        const handleResize = () => {
           if (!containerRef.current || !client) return;
           
           const display = client.getDisplay();
           const displayW = display.getWidth();
           const displayH = display.getHeight();
           
           if (displayW === 0 || displayH === 0) return;

           const containerW = containerRef.current.clientWidth;
           const containerH = containerRef.current.clientHeight;

           // Scale kiểu "fit" (giữ nguyên tỉ lệ khung hình)
           const scale = Math.min(containerW / displayW, containerH / displayH);
           display.scale(scale);
        };

        // Dùng ResizeObserver để tự động scale khi div cha thay đổi kích thước
        resizeObserver = new ResizeObserver(() => {
            window.requestAnimationFrame(handleResize);
        });
        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        // --- EVENTS ---
        client.onstatechange = (state: number) => {
          const map = ["IDLE", "CONNECTING", "WAITING", "CONNECTED", "DISCONNECTING", "DISCONNECTED"];
          const stateStr = map[state] || `STATE_${state}`;
          console.log(`🔌 VDI State: ${stateStr}`);
          
          setStatus(stateStr);
          
          if (state === 3) { // 3 = CONNECTED
             // Đợi DOM cập nhật rồi scale lại cho đẹp
             setTimeout(handleResize, 100);
          }
        };

        client.onerror = (e: any) => { 
            console.error("Guac Error:", e); 
            setStatus("CONNECTION ERROR"); 
        };

        // Gắn Element của Guacamole vào DOM
        const displayEl = client.getDisplay().getElement();
        
        // Setup Kiosk Input (chuột/phím)
        cleanupInput = setupKioskInput(client, displayEl);
        
        if (displayRef.current) {
          displayRef.current.innerHTML = "";
          displayRef.current.appendChild(displayEl);
        }

        // Bắt đầu kết nối
        client.connect('');

      } catch (err) {
        console.error("Init Error:", err);
        setStatus("CLIENT_EXCEPTION");
      }
    };

    connectVDI();

    return () => {
      console.log("🧹 Cleaning up VDI connection...");
      if (cleanupInput) cleanupInput();
      if (resizeObserver) resizeObserver.disconnect();
      
      if (client) {
         // Ngắt kết nối sạch sẽ
         try { client.disconnect(); } catch {}
      }
    };
  }, [token, setupKioskInput]); // Chỉ chạy lại khi token thay đổi

  // --- 4. RENDER UI ---
  const isViolation = isConnected && !isTimeUp && (!isFullScreen || !isTabActive);
  const isUnlockedWarning = isConnected && !isTimeUp && isFullScreen && !isLocked;

  return (
    <div className="flex flex-col w-full h-screen bg-gray-900 overflow-hidden select-none font-sans">
      
      {/* === [1] INFO HEADER === */}
      {isConnected && !isViolation && (
        <div className="h-8 bg-[#1a1a1a] flex items-center justify-between px-4 text-xs z-[60] border-b border-gray-800 flex-none">
           <div className="flex items-center gap-4 text-gray-400">
              <div className="flex items-center gap-2">
                 <span className="text-gray-500">Thí sinh:</span>
                 <span className="font-bold text-white uppercase">{studentName}</span>
              </div>
              <span className="w-[1px] h-3 bg-gray-700"></span>
              <div className="flex items-center gap-2">
                 <span className="text-gray-500">Máy ảo:</span>
                 <span className="font-mono text-yellow-500">{vmName}</span>
              </div>
           </div>

           {endTime && (
              <div className={`font-mono font-bold text-sm tracking-wide ${
                  isCriticalTime ? 'text-red-500 animate-pulse' : 'text-blue-400'
              }`}>
                  {isTimeUp ? "HẾT GIỜ" : timeLeftStr}
              </div>
           )}
        </div>
      )}

      {/* === [2] SAFETY BAR (Click để focus lại) === */}
      <div 
         className="h-1.5 bg-blue-600 w-full z-50 flex-none cursor-pointer hover:bg-blue-500 transition-colors shadow-md shadow-blue-900/50"
         onClick={handleResume}
         title="Click vào đây để khóa lại chuột"
      />

      {/* === [3] ACTION BAR === */}
      {isConnected && !isViolation && (
        <div className="h-10 bg-gray-900 flex items-center justify-between px-4 border-b border-gray-800 z-40 flex-none">
            <div className="text-gray-500 text-xs italic flex items-center gap-2">
                {isLocked ? (
                    <>
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span>Đang khóa chuột. Nhấn <b>Alt + Enter</b> để hiện con trỏ.</span>
                    </>
                ) : (
                    <>
                        <span className="w-2 h-2 bg-yellow-500 rounded-full"></span>
                        <span>Đã hiện chuột. Click vào màn hình đen để điều khiển lại.</span>
                    </>
                )}
            </div>

            <button 
                onClick={onExit}
                className="bg-red-600 hover:bg-red-700 text-white text-xs font-bold px-5 py-1.5 rounded shadow transition-all hover:scale-105 active:scale-95 flex items-center gap-2"
            >
                <span>⏹</span> NỘP BÀI & THOÁT
            </button>
        </div>
      )}

      {/* === [4] VM DISPLAY AREA === */}
      <div ref={containerRef} className="flex-1 relative w-full bg-black overflow-hidden group">
          
          {/* Cảnh báo vi phạm */}
          {isViolation && (
              <div className="absolute inset-0 z-[200] bg-red-900/95 flex flex-col items-center justify-center text-white animate-fade-in p-8 text-center cursor-default">
                  <div className="bg-black/50 p-8 rounded-2xl border-4 border-red-500 shadow-2xl max-w-2xl">
                      <div className="text-6xl mb-4">⚠️</div>
                      <h2 className="text-3xl font-bold mb-4 uppercase text-red-400">Cảnh báo hệ thống</h2>
                      <p className="text-xl mb-6">{!isFullScreen ? "Bạn đã thoát khỏi chế độ Toàn màn hình." : "Hệ thống phát hiện bạn đã chuyển Tab."}</p>
                      <button onClick={handleResume} className="px-8 py-4 bg-white text-red-900 font-bold text-lg rounded-lg shadow-lg hover:bg-gray-200 transition transform">QUAY LẠI LÀM BÀI NGAY</button>
                  </div>
              </div>
          )}

          {/* Cảnh báo mất chuột tạm thời */}
          {isUnlockedWarning && !isViolation && (
             <div className="absolute inset-0 z-[150] bg-black/60 flex flex-col items-center justify-center cursor-pointer backdrop-blur-sm" onClick={handleResume}>
                 <div className="bg-blue-600/90 text-white p-6 rounded-xl shadow-2xl animate-bounce text-center border border-white/20">
                     <h3 className="text-2xl font-bold mb-2">CLICK ĐỂ TIẾP TỤC</h3>
                     <p className="text-sm opacity-90">Chuột đã bị thoát ra ngoài. Click vào đây để tiếp tục.</p>
                 </div>
             </div>
          )}

          {/* Loading / Waiting Screen */}
          {!isConnected && (
            <div className="absolute inset-0 flex items-center justify-center bg-gray-900 text-white z-50">
               <div className="flex flex-col items-center">
                 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mb-4"></div>
                 <p className="font-mono text-sm tracking-widest uppercase">{status}</p>
                 <p className="text-xs text-gray-500 mt-2">Đang kết nối tới máy chủ...</p>
               </div>
            </div>
          )}

          {/* Tooltip hướng dẫn (Hover) */}
          {isLocked && !isViolation && (
             <div className="absolute top-0 left-1/2 transform -translate-x-1/2 z-50 opacity-0 group-hover:opacity-100 transition-opacity duration-500 delay-1000 pointer-events-none">
                 <div className="bg-black/50 text-white text-[10px] px-3 py-1 rounded-b backdrop-blur-sm border border-white/10">
                    Nhấn <b>Alt + Enter</b> để hiện chuột nộp bài
                 </div>
             </div>
          )}

          {/* Nơi chứa Canvas của Guacamole */}
          <div ref={displayRef} className="absolute inset-0 z-10 w-full h-full" />
      </div>
    </div>
  );
}