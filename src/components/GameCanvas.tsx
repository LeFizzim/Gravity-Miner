import React, { useRef, useEffect } from 'react';
import GameEngine from '../game/GameEngine';

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      engine.canvasWidth = canvas.width;
      engine.canvasHeight = canvas.height;
    };

    const handleMouseDown = (e: MouseEvent) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        engine.handleClick(x, y);
    };

    window.addEventListener('resize', handleResize);
    canvas.addEventListener('mousedown', handleMouseDown);

    let animationFrameId: number;

    const gameLoop = () => {
      // Clear canvas
      context.clearRect(0, 0, canvas.width, canvas.height);

      // Update and Draw Engine
      engine.update();
      engine.draw(context);

      animationFrameId = requestAnimationFrame(gameLoop);
    };

    gameLoop(); 

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      canvas.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);

  return <canvas ref={canvasRef} style={{ display: 'block' }} />;
};

export default GameCanvas;