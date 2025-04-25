// src/hooks/renderer/useGameRenderer.ts
import { useState, useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { GameSystem, Position } from 'game-logic';
import { useMapRenderer } from './useMapRenderer';
import { useUnitRenderer } from './useUnitRenderer';
import { useRangeRenderer } from './useRangeRenderer';
import { useEventHandlers } from './useEventHandlers';
import { useAnimation } from './useAnimation';
import { useCamera } from './useCamera';
import { GameConnectionState } from '../useGameConnection';

/**
 * ゲームレンダリングを統合管理するメインフック
 */
export function useGameRenderer(
  appRef: React.RefObject<PIXI.Application | null>,
  gameSystemRef: React.RefObject<GameSystem | null>,
  isAppInitialized: boolean = false,
  currentActionType: string | null,
  _connectionState?: GameConnectionState,
  moveUnit?: (unitId: string, targetPosition: Position) => void,
  executeAction?: (
    sourceUnitId: string,
    targetUnitId: string,
    targetPosition: Position,
    actionType: string
  ) => void
) {
  // コンテナの参照
  const mapContainerRef = useRef<PIXI.Container | null>(null);
  const unitContainerRef = useRef<PIXI.Container | null>(null);
  const overlayContainerRef = useRef<PIXI.Container | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  // 初期化が完了したかどうかの状態
  const [initializationComplete, setInitializationComplete] =
    useState<boolean>(false);

  // 選択ユニットの状態
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // マップレンダラー
  const { renderMap, resetAndRedraw } = useMapRenderer(mapContainerRef);

  // ユニットレンダラー
  const { renderUnits, unitsRef } = useUnitRenderer(
    unitContainerRef,
    selectedUnitId
  );

  // 範囲表示
  const {
    showMoveRange,
    clearMoveRange,
    showActionRange,
    clearActionRange,
    clearAllRanges,
  } = useRangeRenderer(gameSystemRef, overlayContainerRef);

  // アニメーション
  const { startMoveAnimation } = useAnimation(gameSystemRef, unitsRef);

  // カメラ制御
  const { centerCamera, panCameraToUnit } = useCamera(appRef, {
    mapContainer: mapContainerRef,
    unitContainer: unitContainerRef,
    overlayContainer: overlayContainerRef,
  });

  // イベントハンドラ
  const { setupEventHandlers } = useEventHandlers(
    gameSystemRef,
    overlayContainerRef,
    mapContainerRef,
    unitContainerRef,
    selectedUnitId,
    setSelectedUnitId,
    currentActionType,
    moveUnit,
    executeAction,
    showMoveRange,
    clearMoveRange,
    showActionRange,
    clearActionRange,
    clearAllRanges,
    startMoveAnimation
  );

  // コンテナ初期化のログ
  useEffect(() => {
    console.log('コンテナ参照状態:', {
      map: !!mapContainerRef.current,
      unit: !!unitContainerRef.current,
      overlay: !!overlayContainerRef.current,
      initialized: isInitializedRef.current,
      complete: initializationComplete,
    });
  }, [
    mapContainerRef.current,
    unitContainerRef.current,
    overlayContainerRef.current,
    isInitializedRef.current,
    initializationComplete,
  ]);

  // アプリの初期化
  useEffect(() => {
    if (!isAppInitialized) {
      console.log('アプリが初期化されていません');
      return;
    }

    console.log('レンダラー初期化開始');

    const app = appRef.current;
    if (!app || !app.stage) {
      console.log('アプリまたはステージが存在しません');
      return;
    }

    // すでに初期化されていればスキップ
    if (isInitializedRef.current) {
      console.log('レンダラーはすでに初期化されています');
      return;
    }

    try {
      // 既存のコンテナをクリーンアップ（念のため）
      if (
        mapContainerRef.current &&
        app.stage.children.includes(mapContainerRef.current)
      ) {
        app.stage.removeChild(mapContainerRef.current);
        mapContainerRef.current.destroy();
        mapContainerRef.current = null;
      }

      if (
        unitContainerRef.current &&
        app.stage.children.includes(unitContainerRef.current)
      ) {
        app.stage.removeChild(unitContainerRef.current);
        unitContainerRef.current.destroy();
        unitContainerRef.current = null;
      }

      if (
        overlayContainerRef.current &&
        app.stage.children.includes(overlayContainerRef.current)
      ) {
        app.stage.removeChild(overlayContainerRef.current);
        overlayContainerRef.current.destroy();
        overlayContainerRef.current = null;
      }

      // コンテナの作成
      const mapContainer = new PIXI.Container();
      const unitContainer = new PIXI.Container();
      const overlayContainer = new PIXI.Container();

      // 名前を設定（デバッグ用）
      mapContainer.name = 'mapContainer';
      unitContainer.name = 'unitContainer';
      overlayContainer.name = 'overlayContainer';

      // ステージに追加
      app.stage.addChild(mapContainer);
      app.stage.addChild(unitContainer);
      app.stage.addChild(overlayContainer);

      // 参照を更新
      mapContainerRef.current = mapContainer;
      unitContainerRef.current = unitContainer;
      overlayContainerRef.current = overlayContainer;

      // カメラを中央に配置
      centerCamera();

      // 初期化完了
      isInitializedRef.current = true;

      // 少し遅延させてから初期描画とイベントハンドラの設定
      setTimeout(() => {
        console.log('遅延初期化の実行');

        // ゲーム状態が存在するか確認
        if (gameSystemRef.current) {
          // 初期描画
          const state = gameSystemRef.current.getState();
          renderMap(state);
          renderUnits(state);
        }

        // イベントハンドラを明示的に設定
        setupEventHandlers();

        // 初期化完了フラグを設定
        setInitializationComplete(true);

        console.log('レンダラー初期化完了');
      }, 100);
    } catch (error) {
      console.error('レンダラー初期化エラー:', error);
    }

    return () => {
      // クリーンアップ処理
      const app = appRef.current;
      if (!app) return;

      // コンテナのクリーンアップ
      if (mapContainerRef.current && app.stage) {
        try {
          app.stage.removeChild(mapContainerRef.current);
          mapContainerRef.current.destroy({ children: true });
          mapContainerRef.current = null;
        } catch (e) {
          console.error('mapContainer クリーンアップエラー:', e);
        }
      }

      if (unitContainerRef.current && app.stage) {
        try {
          app.stage.removeChild(unitContainerRef.current);
          unitContainerRef.current.destroy({ children: true });
          unitContainerRef.current = null;
        } catch (e) {
          console.error('unitContainer クリーンアップエラー:', e);
        }
      }

      if (overlayContainerRef.current && app.stage) {
        try {
          app.stage.removeChild(overlayContainerRef.current);
          overlayContainerRef.current.destroy({ children: true });
          overlayContainerRef.current = null;
        } catch (e) {
          console.error('overlayContainer クリーンアップエラー:', e);
        }
      }

      // 参照をクリア
      isInitializedRef.current = false;
      setInitializationComplete(false);
    };
  }, [isAppInitialized, appRef, centerCamera, setupEventHandlers]);

  // アクティブユニットの変更を監視して自動的にカメラをパンする
  useEffect(() => {
    if (!isAppInitialized || !initializationComplete) return;

    const checkActiveUnitChange = () => {
      const gameSystem = gameSystemRef.current;
      if (!gameSystem) return;

      const state = gameSystem.getState();
      const currentActiveUnitId = state.activeUnitId;

      // 前回のアクティブユニットID
      const lastActiveUnitIdKey = 'lastActiveUnitId';
      const lastActiveUnitId = localStorage.getItem(lastActiveUnitIdKey);

      // アクティブユニットが変わっていればカメラを移動
      if (currentActiveUnitId && currentActiveUnitId !== lastActiveUnitId) {
        console.log(
          `アクティブユニットが変更されました: ${currentActiveUnitId}`
        );
        localStorage.setItem(lastActiveUnitIdKey, currentActiveUnitId);

        // アクティブユニットの位置を取得
        const activeUnit = state.units.find(
          (unit) => unit.id === currentActiveUnitId
        );

        if (activeUnit) {
          // ユニットの位置にカメラを移動
          const tile = state.map.getTile(activeUnit.position);
          const height = tile ? tile.height : 0;
          panCameraToUnit(activeUnit, height);

          // 通知メッセージを表示
          if (window.showGameNotification) {
            window.showGameNotification(`${activeUnit.name}の行動です`);
          }
        }
      }
    };

    // 定期的にアクティブユニットをチェック
    const intervalId = setInterval(checkActiveUnitChange, 300);

    return () => {
      clearInterval(intervalId);
    };
  }, [isAppInitialized, initializationComplete, panCameraToUnit]);

  // ゲーム状態が変更されたときの再描画
  useEffect(() => {
    if (!isAppInitialized || !initializationComplete) return;

    console.log('ゲーム状態更新監視を開始');

    const intervalId = setInterval(() => {
      renderGameState();
    }, 100); // 100ms間隔で再描画

    return () => {
      clearInterval(intervalId);
    };
  }, [isAppInitialized, initializationComplete]);

  // ゲーム状態の描画
  const renderGameState = () => {
    const gameSystem = gameSystemRef.current;
    if (!gameSystem) return;

    try {
      const state = gameSystem.getState();

      // コンテナが存在するか確認
      if (!mapContainerRef.current || !unitContainerRef.current) {
        console.warn('コンテナが存在しないためレンダリングをスキップします');
        return;
      }

      // マップとユニットを描画
      renderMap(state);
      renderUnits(state);
    } catch (error) {
      console.error('ゲーム状態描画エラー:', error);
    }
  };

  // 完全再描画（問題が発生した場合に使用）
  const forceRedraw = () => {
    try {
      console.log('強制再描画を実行');
      const gameSystem = gameSystemRef.current;
      if (!gameSystem) return;

      const state = gameSystem.getState();
      resetAndRedraw(state);
      renderUnits(state);
    } catch (error) {
      console.error('強制再描画エラー:', error);
    }
  };

  // アクション選択のためのハンドラー関数
  const handleActionSelect = (actionType: string, unitId: string) => {
    if (!gameSystemRef.current) return;

    console.log(`アクション選択: ${actionType} (ユニット: ${unitId})`);

    const gameSystem = gameSystemRef.current;
    const state = gameSystem.getState();
    const unit = state.units.find((u) => u.id === unitId);

    if (!unit) return;

    // 以前の表示をクリア
    clearAllRanges();

    // 選択済みのアクションを再度クリックした場合は選択解除
    if (currentActionType === actionType) {
      console.log('アクション選択解除');
      return;
    }

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

  return {
    selectedUnitId,
    setSelectedUnitId,
    showMoveRange,
    clearMoveRange,
    showActionRange,
    clearActionRange,
    handleActionSelect,
    forceRedraw, // 必要に応じて外部から強制再描画できるようにエクスポート
    isInitialized: initializationComplete, // 初期化状態を外部から確認できるようにエクスポート
  };
}
