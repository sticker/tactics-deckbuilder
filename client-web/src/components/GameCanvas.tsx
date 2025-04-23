import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { GameSystem } from 'game-logic';
import { useGameLoop } from '../hooks/useGameLoop';
import { useGameRenderer } from '../hooks/useGameRenderer';
import { useGameConnection } from '../hooks/useGameConnection';
import GameUI from './GameUI';

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const gameSystemRef = useRef<GameSystem | null>(null);
  const [_, setForceUpdate] = useState(0);

  // ゲームの初期化
  useEffect(() => {
    if (!canvasRef.current) return;

    // PixiJSアプリケーションの作成 - v7対応
    const app = new PIXI.Application({
      backgroundColor: 0x0a0a23,
      resizeTo: canvasRef.current,
    });
    
    // v7では従来通りcanvasを追加（型キャストして対応）
    canvasRef.current.appendChild(app.view as unknown as Node);
    appRef.current = app;
    
    // ゲームシステムの初期化
    const gameSystem = new GameSystem(13, 13);
    gameSystem.setupInitialState();
    gameSystemRef.current = gameSystem;

    return () => {
      app.destroy(true);
      // クリーンアップもv7用に修正（型キャストして対応）
      if (canvasRef.current && app.view && canvasRef.current.contains(app.view as unknown as Node)) {
        canvasRef.current.removeChild(app.view as unknown as Node);
      }
    };
  }, []);

  // ゲーム状態更新時の強制再レンダリング
  const handleStateUpdate = () => {
    setForceUpdate(prev => prev + 1);
  };

  // サーバー接続のセットアップ
  const { connectionState } = useGameConnection(gameSystemRef, handleStateUpdate);

  // ゲームレンダラーのセットアップ
  const { selectedUnitId } = useGameRenderer(appRef, gameSystemRef);

  // ゲームループのセットアップ
  useGameLoop(gameSystemRef);

  return (
    <div className="w-full h-full relative">
      <div ref={canvasRef} className="w-full h-full" />
      
      {connectionState.teamId !== null && (
        <div className="absolute top-4 right-4 bg-gray-800 p-2 rounded text-white">
          チーム: {connectionState.teamId === 0 ? '青' : '赤'}
        </div>
      )}
      
      {connectionState.error && (
        <div className="absolute top-4 left-4 bg-red-800 p-2 rounded text-white">
          {connectionState.error}
        </div>
      )}
      
      <GameUI gameSystem={gameSystemRef.current} selectedUnitId={selectedUnitId} />
    </div>
  );
};

export default GameCanvas;