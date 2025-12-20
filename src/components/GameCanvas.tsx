import React, { useRef, useEffect } from 'react';
import GameEngine from '../game/GameEngine';

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const resizeTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    // Initial Setup
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const engine = new GameEngine(canvas.width, canvas.height);

    const handleResize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      
      engine.isResizing = true;
      engine.resize(canvas.width, canvas.height);
      
      if (resizeTimeoutRef.current) {
          clearTimeout(resizeTimeoutRef.current);
      }
      resizeTimeoutRef.current = window.setTimeout(() => {
          engine.isResizing = false;
      }, 100);
    };

    const handleInput = (type: string, e: MouseEvent | TouchEvent) => {
        const rect = canvas.getBoundingClientRect();
        let clientX, clientY;

        if (e instanceof MouseEvent) {
            clientX = e.clientX;
            clientY = e.clientY;
        } else {
            clientX = e.touches[0]?.clientX || e.changedTouches[0]?.clientX;
            clientY = e.touches[0]?.clientY || e.changedTouches[0]?.clientY;
        }

        const x = clientX - rect.left;
        const y = clientY - rect.top;
        engine.handleInput(type, x, y);
    };

    const onMouseDown = (e: MouseEvent) => handleInput('mousedown', e);
    const onMouseUp = (e: MouseEvent) => handleInput('mouseup', e);
    const onMouseMove = (e: MouseEvent) => handleInput('mousemove', e);
    
    // Basic touch support
    const onTouchStart = (e: TouchEvent) => handleInput('mousedown', e);
    const onTouchEnd = (e: TouchEvent) => handleInput('mouseup', e);

    const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
            engine.togglePause();
        }
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('keydown', onKeyDown);
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('touchstart', onTouchStart);
    canvas.addEventListener('touchend', onTouchEnd);

    let animationFrameId: number;
    let lastTime = performance.now();

    const gameLoop = (time: number) => {
      const dt = Math.min(time - lastTime, 50); // Cap dt to 50ms to prevent huge jumps
      lastTime = time;

      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Update and Draw Engine
      engine.update(dt);
      engine.draw(context);
      
      // Update Cursor
      canvas.style.cursor = engine.isHoveringButton ? 'pointer' : 'default';

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    animationFrameId = requestAnimationFrame(gameLoop); 

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('keydown', onKeyDown);
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('mouseup', onMouseUp);
      canvas.removeEventListener('mousemove', onMouseMove);
      canvas.removeEventListener('touchstart', onTouchStart);
      canvas.removeEventListener('touchend', onTouchEnd);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
};

export default GameCanvas;
