// frontend/app/hooks/useKioskMode.ts
import { useEffect, useRef, useState, useCallback } from "react";
import Guacamole from "guacamole-common-js";

export const useKioskMode = (enableLock: boolean = true) => {
  const mouseState = useRef({ 
      x: 0, y: 0, 
      left: false, middle: false, right: false, up: false, down: false 
  });
  
  // State theo dõi các vi phạm/trạng thái màn hình
  const [isLocked, setIsLocked] = useState(false); // Chuột có bị khóa không?
  const [isFullScreen, setIsFullScreen] = useState(true); // Có đang full màn hình không?
  const [isTabActive, setIsTabActive] = useState(true); // Có đang ở tab này không?

  // 1. THEO DÕI TRẠNG THÁI FULLSCREEN & POINTER LOCK & TAB VISIBILITY
  useEffect(() => {
    const handleChange = () => {
      // Check Pointer Lock
      const lockedElement = document.pointerLockElement || (document as any).mozPointerLockElement;
      setIsLocked(!!lockedElement);

      // Check Full Screen
      const fsElement = document.fullscreenElement || (document as any).mozFullScreenElement || (document as any).webkitFullscreenElement;
      setIsFullScreen(!!fsElement);

      // Check Tab Active
      setIsTabActive(!document.hidden);
    };

    // Gắn sự kiện
    document.addEventListener("pointerlockchange", handleChange);
    document.addEventListener("mozpointerlockchange", handleChange);
    document.addEventListener("fullscreenchange", handleChange);
    document.addEventListener("webkitfullscreenchange", handleChange); // Chrome/Safari cũ
    document.addEventListener("mozfullscreenchange", handleChange);
    document.addEventListener("visibilitychange", handleChange); // Phát hiện Alt-Tab
    
    // Gọi 1 lần để init state
    handleChange();

    return () => {
        document.removeEventListener("pointerlockchange", handleChange);
        document.removeEventListener("mozpointerlockchange", handleChange);
        document.removeEventListener("fullscreenchange", handleChange);
        document.removeEventListener("webkitfullscreenchange", handleChange);
        document.removeEventListener("mozfullscreenchange", handleChange);
        document.removeEventListener("visibilitychange", handleChange);
    };
  }, []);

  // 2. CHẶN COPY / PASTE / CONTEXT MENU
  useEffect(() => {
      if (!enableLock) return;

      const preventDefault = (e: Event) => {
          e.preventDefault();
          e.stopPropagation();
          // Có thể thêm logic: Gửi cảnh báo về server nếu muốn
          console.warn("🚫 Action blocked by Anti-Cheat System");
      };

      window.addEventListener("copy", preventDefault);
      window.addEventListener("cut", preventDefault);
      window.addEventListener("paste", preventDefault);
      window.addEventListener("contextmenu", preventDefault);

      return () => {
          window.removeEventListener("copy", preventDefault);
          window.removeEventListener("cut", preventDefault);
          window.removeEventListener("paste", preventDefault);
          window.removeEventListener("contextmenu", preventDefault);
      };
  }, [enableLock]);

  // 3. TỰ ĐỘNG MỞ KHÓA KHI HẾT GIỜ
  useEffect(() => {
    if (!enableLock) {
        if (document.pointerLockElement) document.exitPointerLock();
        if (document.fullscreenElement) document.exitFullscreen();
    }
  }, [enableLock]);

  // 4. HÀM KÍCH HOẠT CHẾ ĐỘ THI (FULLSCREEN + LOCK)
  const enterExamMode = useCallback(async (displayEl: HTMLElement) => {
      if (!enableLock) return;
      try {
          // A. Yêu cầu Full Screen trước (Browser yêu cầu user gesture)
          if (!document.fullscreenElement) {
              const el = document.documentElement; // Full screen cả trang web
              const req = el.requestFullscreen || (el as any).webkitRequestFullscreen || (el as any).msRequestFullscreen;
              if (req) await req.call(el);
          }

          // B. Sau đó yêu cầu Pointer Lock
          displayEl.requestPointerLock = displayEl.requestPointerLock || (displayEl as any).mozRequestPointerLock;
          displayEl.requestPointerLock();
          (displayEl as any).focus();

          // C. Cố gắng khóa phím Esc (Nếu có HTTPS)
          if ('keyboard' in navigator && 'lock' in (navigator.keyboard as any)) {
            await (navigator.keyboard as any).lock(['Escape']);
          }
      } catch (err) {
          console.warn("Enter Exam Mode failed:", err);
      }
  }, [enableLock]);

  // 5. SETUP GUACAMOLE INPUT (Logic cũ + cập nhật Mouse)
  const setupKioskInput = useCallback((client: any, displayEl: HTMLElement) => {
    if (!client || !displayEl) return () => {};

    const handleClick = () => enterExamMode(displayEl);

    // --- CẬP NHẬT: ĐỔI SANG ALT + ENTER ---
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Logic: Nếu đang khóa chuột + Nhấn Alt + Enter -> Thì mở khóa
      if (document.pointerLockElement === displayEl && e.altKey && e.key === "Enter") {
        document.exitPointerLock();
        e.preventDefault(); 
        e.stopPropagation();
        console.log("Mouse unlocked by user (Alt + Enter)");
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!client) return;
      if (document.pointerLockElement === displayEl) {
        mouseState.current.x += e.movementX;
        mouseState.current.y += e.movementY;
        const w = client.getDisplay().getWidth();
        const h = client.getDisplay().getHeight();
        mouseState.current.x = Math.max(0, Math.min(mouseState.current.x, w));
        mouseState.current.y = Math.max(0, Math.min(mouseState.current.y, h));
      } else {
        const rect = displayEl.getBoundingClientRect();
        mouseState.current.x = e.clientX - rect.left;
        mouseState.current.y = e.clientY - rect.top;
      }
      
      client.sendMouseState(new Guacamole.Mouse.State(
          mouseState.current.x, mouseState.current.y,
          mouseState.current.left, mouseState.current.middle, mouseState.current.right,
          mouseState.current.up, mouseState.current.down
      ));
    };

    const handleMouseDown = (e: MouseEvent) => { 
        if(e.button === 0) mouseState.current.left = true;
        if(e.button === 1) mouseState.current.middle = true;
        if(e.button === 2) mouseState.current.right = true;
        client.sendMouseState(new Guacamole.Mouse.State(
          mouseState.current.x, mouseState.current.y,
          mouseState.current.left, mouseState.current.middle, mouseState.current.right,
          mouseState.current.up, mouseState.current.down
        ));
    };

    const handleMouseUp = (e: MouseEvent) => { 
        if(e.button === 0) mouseState.current.left = false;
        if(e.button === 1) mouseState.current.middle = false;
        if(e.button === 2) mouseState.current.right = false;
        client.sendMouseState(new Guacamole.Mouse.State(
          mouseState.current.x, mouseState.current.y,
          mouseState.current.left, mouseState.current.middle, mouseState.current.right,
          mouseState.current.up, mouseState.current.down
        ));
    };

    displayEl.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleGlobalKeyDown, true);
    document.addEventListener("mousemove", handleMouseMove);
    displayEl.addEventListener("mousedown", handleMouseDown);
    displayEl.addEventListener("mouseup", handleMouseUp);
    displayEl.oncontextmenu = (e: any) => { e.preventDefault(); return false; };

    return () => {
      displayEl.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleGlobalKeyDown, true);
      document.removeEventListener("mousemove", handleMouseMove);
      displayEl.removeEventListener("mousedown", handleMouseDown);
      displayEl.removeEventListener("mouseup", handleMouseUp);
    };
  }, [enableLock, enterExamMode]);

  return { 
      setupKioskInput, 
      enterExamMode, // Xuất hàm này để Component gọi khi bấm nút "Quay lại thi"
      isLocked, 
      isFullScreen, 
      isTabActive 
  };
};