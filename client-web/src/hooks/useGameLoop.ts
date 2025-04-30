import { useEffect, useRef } from 'react';
import { GameSystem } from 'game-logic';

// useGameLoop.ts のゲームループを修正
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
        try {
          const prevActiveId = gameSystemRef.current.getState().activeUnitId;
          gameSystemRef.current.processTick();
          const newActiveId = gameSystemRef.current.getState().activeUnitId;

          // アクティブユニットが変わった場合のみログ出力
          if (prevActiveId !== newActiveId) {
            console.log(
              `アクティブユニット変更: ${prevActiveId} -> ${newActiveId}`
            );
          }
        } catch (error) {
          console.error('ゲームティック処理エラー:', error);
        }

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
