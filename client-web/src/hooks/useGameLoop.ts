import { useEffect, useRef } from 'react';
import { GameSystem } from 'game-logic';

export function useGameLoop(gameSystemRef: React.RefObject<GameSystem | null>) {
  const frameIdRef = useRef<number | null>(null);
  const lastTickTimeRef = useRef<number>(0);
  const tickIntervalRef = useRef<number>(100); // 0.1秒ごとにtick

  useEffect(() => {
    const gameLoop = (timestamp: number) => {
      if (!gameSystemRef.current) return;

      // 前回のティック時間からの経過時間をチェック
      if (timestamp - lastTickTimeRef.current >= tickIntervalRef.current) {
        // CTの処理を行う
        gameSystemRef.current.processTick();
        lastTickTimeRef.current = timestamp;
      }

      frameIdRef.current = requestAnimationFrame(gameLoop);
    };

    // ゲームループを開始
    frameIdRef.current = requestAnimationFrame(gameLoop);

    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
    };
  }, [gameSystemRef]);
}