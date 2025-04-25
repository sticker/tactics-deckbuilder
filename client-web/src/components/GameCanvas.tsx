// src/components/GameCanvas.tsx
import React, { useEffect, useRef, useState } from 'react';
import * as PIXI from 'pixi.js';
import { GameSystem, Position } from 'game-logic';
import { useGameLoop } from '../hooks/useGameLoop';
import { useGameRenderer } from '../hooks/renderer/useGameRenderer';
import { useGameConnection } from '../hooks/useGameConnection';
import GameUI from './GameUI';
import {
  debugGameSystem,
  debugContainers,
  forceInitializeGameSystem,
} from '../utils/debugHelpers';

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const gameSystemRef = useRef<GameSystem | null>(null);
  const [appInitialized, setAppInitialized] = useState(false);
  const [_, setForceUpdate] = useState(0);
  const [currentActionType, setCurrentActionType] = useState<string | null>(
    null
  );

  // デバッグ用の状態
  const [debugMode, setDebugMode] = useState(false);

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

      // 初期状態の設定
      try {
        console.log('ゲームシステムの初期状態を設定中...');
        gameSystem.setupInitialState();
        console.log('ゲームシステムの初期状態設定完了');
      } catch (error) {
        console.error('初期状態設定エラー:', error);
      }

      // 参照を保存
      appRef.current = app;
      gameSystemRef.current = gameSystem;

      // デバッグモードキーイベントリスナーの設定
      window.addEventListener('keydown', handleDebugKeyDown);

      console.log('ゲーム初期化完了');
      setAppInitialized(true);

      // 初期化直後にデバッグ情報を出力
      setTimeout(() => {
        debugGameSystem(gameSystem);
      }, 500);
    } catch (error) {
      console.error('ゲーム初期化エラー:', error);
    }

    return () => {
      // クリーンアップ処理
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
      window.removeEventListener('keydown', handleDebugKeyDown);
    };
  }, []);

  // デバッグキー処理
  const handleDebugKeyDown = (e: KeyboardEvent) => {
    // Ctrl+Shift+D でデバッグモードの切り替え
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      setDebugMode((prev) => !prev);
      if (!debugMode) {
        // デバッグモードON時に診断を実行
        debugGameSystem(gameSystemRef.current);
      }
    }

    // Ctrl+Shift+R でゲームシステム再初期化
    if (e.ctrlKey && e.shiftKey && e.key === 'R') {
      console.log('ゲームシステムを再初期化します');
      if (gameSystemRef.current) {
        forceInitializeGameSystem(gameSystemRef.current);
        // 状態更新をトリガー
        setForceUpdate((prev) => prev + 1);
      }
    }
  };

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

    // デバッグモード時は詳細情報を表示
    if (debugMode) {
      debugGameSystem(gameSystemRef.current);
    }
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
    targetPosition: Position,
    actionType: string
  ) => {
    if (!gameSystemRef.current) return;

    console.log(
      `アクション実行開始: ${actionType}`,
      sourceUnitId,
      targetUnitId
    );

    const gameSystem = gameSystemRef.current;

    // アクションタイプを引数から直接使用
    const result = gameSystem.executeAction(
      sourceUnitId,
      actionType,
      targetUnitId,
      targetPosition
    );

    if (result.success) {
      console.log(`${actionType}アクション成功!`);
      if (window.showGameNotification) {
        window.showGameNotification(
          `${
            actionType.startsWith('attack') ? '攻撃' : '回復'
          }アクションを実行しました`
        );
      }
    } else {
      console.log('アクション実行失敗:', result.reason);

      // エラー理由に応じたメッセージを表示
      if (window.showGameNotification) {
        let errorMessage = 'アクションの実行に失敗しました';

        if (result.reason === 'active_unit_check_failed') {
          // 既に行動済みかどうかのチェックが原因の場合は通知しない
          // (二重クリックの場合は通知しない)
          return;
        } else if (result.reason === 'target_out_of_range') {
          errorMessage = '対象が範囲外です';
        } else if (result.reason === 'unit_not_found') {
          errorMessage = 'ユニットが見つかりません';
        }

        window.showGameNotification(errorMessage);
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
    handleActionSelect,
    forceRedraw,
    isInitialized,
  } = useGameRenderer(
    appRef,
    gameSystemRef,
    appInitialized,
    currentActionType,
    connectionState,
    moveUnit,
    executeAction
  );

  // ゲームループのセットアップ
  useGameLoop(gameSystemRef);

  // selectedUnitIdの状態変化を監視するデバッグログ
  useEffect(() => {
    console.log('GameCanvas: selectedUnitId 更新:', selectedUnitId);
  }, [selectedUnitId]);

  // レンダラー初期化状態の監視
  useEffect(() => {
    console.log('レンダラー初期化状態:', isInitialized);

    // レンダラーが初期化されたら、念のためデバッグ情報を出力
    if (isInitialized) {
      // コンテナの状態を診断
      if (appRef.current) {
        const stageChildren = appRef.current.stage?.children || [];
        const mapContainer = stageChildren.find(
          (child) => child.name === 'mapContainer'
        ) as PIXI.Container;
        const unitContainer = stageChildren.find(
          (child) => child.name === 'unitContainer'
        ) as PIXI.Container;
        const overlayContainer = stageChildren.find(
          (child) => child.name === 'overlayContainer'
        ) as PIXI.Container;

        debugContainers(mapContainer, unitContainer, overlayContainer);
      }

      // 念のため強制再描画を行う（初回のみ）
      setTimeout(() => {
        if (forceRedraw) {
          console.log('初期化完了後の強制再描画を実行');
          forceRedraw();
        }
      }, 1000);
    }
  }, [isInitialized, forceRedraw]);

  // アクション選択のハンドラー
  const onActionSelect = (actionType: string, unitId: string) => {
    if (!gameSystemRef.current) return;

    console.log(`アクション選択: ${actionType} (ユニット: ${unitId})`);

    const gameSystem = gameSystemRef.current;
    const state = gameSystem.getState();
    const unit = state.units.find((u) => u.id === unitId);

    if (!unit) return;

    // 選択済みのアクションを再度クリックした場合は選択解除
    if (currentActionType === actionType) {
      console.log('アクション選択解除');
      setCurrentActionType(null);
      return;
    }

    // 現在のアクションを設定
    console.log('アクションタイプをセット:', actionType);
    setCurrentActionType(actionType);

    // アクション選択ハンドラを呼び出し
    handleActionSelect(actionType, unitId);
  };

  // デバッグモード用のUI
  const renderDebugUI = () => {
    if (!debugMode) return null;

    return (
      <div className='absolute top-0 right-0 bg-red-700 bg-opacity-90 text-white p-2 rounded m-2 z-50'>
        <div className='text-xs font-bold mb-1'>デバッグモード</div>
        <div className='space-y-1'>
          <button
            className='bg-blue-500 text-xs p-1 rounded block w-full'
            onClick={() => debugGameSystem(gameSystemRef.current)}
          >
            状態診断
          </button>
          <button
            className='bg-green-500 text-xs p-1 rounded block w-full'
            onClick={() => forceRedraw && forceRedraw()}
          >
            強制再描画
          </button>
          <button
            className='bg-yellow-500 text-xs p-1 rounded block w-full'
            onClick={() => forceInitializeGameSystem(gameSystemRef.current)}
          >
            状態リセット
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className='w-full h-full relative'>
      <div ref={canvasRef} className='w-full h-full absolute inset-0' />

      <GameUI
        gameSystem={gameSystemRef.current}
        selectedUnitId={selectedUnitId}
        connectionState={connectionState}
        onActionSelect={onActionSelect}
        currentActionType={currentActionType}
      />

      {renderDebugUI()}
    </div>
  );
};

export default GameCanvas;
