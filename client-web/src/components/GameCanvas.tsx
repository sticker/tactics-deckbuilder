import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { GameSystem, Position } from 'game-logic';
import { useGameLoop } from '../hooks/useGameLoop';
import { useGameRenderer } from '../hooks/useGameRenderer';
import { useGameConnection } from '../hooks/useGameConnection';
import GameUI from './GameUI';

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const gameSystemRef = useRef<GameSystem | null>(null);
  const [appInitialized, setAppInitialized] = useState(false);
  const [_, setForceUpdate] = useState(0);
  const [currentActionType, setCurrentActionType] = useState<string | null>(
    null
  );

  // ゲームの初期化
  useEffect(() => {
    // すでに初期化されている場合は何もしない
    if (appRef.current) return;

    // 要素がマウントされているか確認
    if (!canvasRef.current) return;

    console.log('ゲーム初期化開始');

    try {
      // 基本的なPixiJSアプリケーションを作成（v7対応）
      const app = new PIXI.Application({
        backgroundColor: 0x0a0a23,
        width: 800, // 固定サイズで開始
        height: 600,
        antialias: true,
      });

      // canvasをDOM要素に追加
      const canvasElement = app.view as unknown as HTMLCanvasElement;
      canvasRef.current.innerHTML = ''; // 念のため既存要素をクリア
      canvasRef.current.appendChild(canvasElement);

      // canvasにスタイルを適用
      canvasElement.style.display = 'block';
      canvasElement.style.width = '100%';
      canvasElement.style.height = '100%';

      // ゲームシステムの初期化
      const gameSystem = new GameSystem(13, 13);
      gameSystem.setupInitialState();

      // 参照を保存
      appRef.current = app;
      gameSystemRef.current = gameSystem;

      console.log('ゲーム初期化完了');
      setAppInitialized(true);
    } catch (error) {
      console.error('ゲーム初期化エラー:', error);
    }

    return () => {
      // クリーンアップ処理
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, []);

  // ウィンドウリサイズのハンドリング
  useEffect(() => {
    if (!appInitialized) return;

    const handleResize = () => {
      if (!canvasRef.current || !appRef.current) return;

      try {
        // 親要素のサイズを取得
        const width = canvasRef.current.clientWidth;
        const height = canvasRef.current.clientHeight;

        console.log('リサイズ:', width, height);

        // レンダラーのリサイズ（安全チェック付き）
        if (appRef.current.renderer) {
          appRef.current.renderer.resize(width, height);
        }

        // 強制更新をトリガー
        setForceUpdate((prev) => prev + 1);
      } catch (error) {
        console.error('リサイズエラー:', error);
      }
    };

    // リサイズイベントリスナーを設定
    window.addEventListener('resize', handleResize);

    // 初期リサイズを実行
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [appInitialized]);

  // ゲーム状態更新時の強制再レンダリング
  const handleStateUpdate = () => {
    setForceUpdate((prev) => prev + 1);
  };

  // サーバー接続のセットアップ
  const { connectionState, moveUnit } = useGameConnection(
    gameSystemRef,
    handleStateUpdate
  );

  // アクションの実行処理
  const executeAction = (
    sourceUnitId: string,
    targetUnitId: string,
    targetPosition: Position
  ) => {
    if (!gameSystemRef.current) return;

    const gameSystem = gameSystemRef.current;

    if (!currentActionType) return;

    // アクションタイプに応じた処理
    const success = gameSystem.executeAction(
      sourceUnitId,
      currentActionType,
      targetUnitId,
      targetPosition
    );

    if (success) {
      console.log(`${currentActionType}アクション成功`);
      if (window.showGameNotification) {
        window.showGameNotification(
          `${
            currentActionType.startsWith('attack') ? '攻撃' : '回復'
          }アクションを実行しました`
        );
      }
    } else {
      if (window.showGameNotification) {
        window.showGameNotification('アクションの実行に失敗しました');
      }
    }

    // 状態をリセット
    setCurrentActionType(null);
    
    // アクション実行後に強制的に再レンダリング
    setTimeout(() => {
      handleStateUpdate();
    }, 100);
  };

  // ゲームレンダラーのセットアップ（アプリ初期化後のみ）
  const {
    selectedUnitId,
    showMoveRange,
    clearMoveRange,
    showActionRange,
    clearActionRange,
  } = useGameRenderer(
    appRef,
    gameSystemRef,
    appInitialized,
    connectionState,
    moveUnit,
    currentActionType, // 追加：現在のアクションタイプ
    executeAction // 追加：アクション実行関数
  );

  // ゲームループのセットアップ
  useGameLoop(gameSystemRef);

  // selectedUnitIdの状態変化を監視するデバッグログ
  useEffect(() => {
    console.log('GameCanvas: selectedUnitId 更新:', selectedUnitId);
  }, [selectedUnitId]);

  // アクション選択のハンドラー
  const handleActionSelect = (actionType: string, unitId: string) => {
    if (!gameSystemRef.current) return;

    console.log(`アクション選択: ${actionType} (ユニット: ${unitId})`);

    const gameSystem = gameSystemRef.current;
    const state = gameSystem.getState();
    const unit = state.units.find((u) => u.id === unitId);

    if (!unit) return;

    // 以前の表示をクリア
    clearMoveRange();
    clearActionRange();

    // 現在のアクションを設定
    setCurrentActionType(actionType);

    if (actionType === 'move') {
      // 移動範囲表示
      showMoveRange(unitId);
    } else if (actionType.startsWith('attack')) {
      // 攻撃範囲表示
      showActionRange(unitId, 'attack', 1); // 攻撃範囲1
    } else if (actionType.startsWith('heal')) {
      // 回復範囲表示
      showActionRange(unitId, 'heal', 2); // 回復範囲2
    }
  };

  return (
    <div className='w-full h-full relative'>
      <div ref={canvasRef} className='w-full h-full absolute inset-0' />

      <GameUI
        gameSystem={gameSystemRef.current}
        selectedUnitId={selectedUnitId}
        connectionState={connectionState}
        onActionSelect={handleActionSelect}
        currentActionType={currentActionType}
      />
    </div>
  );
};

export default GameCanvas;
