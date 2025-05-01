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

/**
 * ゲームレンダリングを統合管理するメインフック
 */
export function useGameRenderer(
  appRef: React.RefObject<PIXI.Application | null>,
  gameSystemRef: React.RefObject<GameSystem | null>,
  isAppInitialized: boolean = false,
  currentActionType: string | null,
  targetSelectionMode: boolean = false, // 追加: パラメータとして受け取る
  _connectionState?: any,
  executeUnitMove?: (unitId: string, targetPosition: Position) => void,
  executeAbility?: (
    sourceUnitId: string,
    targetUnitId: string,
    abilityId: string
  ) => void
) {
  const mapContainerRef = useRef<PIXI.Container | null>(null);
  const unitContainerRef = useRef<PIXI.Container | null>(null);
  const overlayContainerRef = useRef<PIXI.Container | null>(null);
  const isInitializedRef = useRef<boolean>(false);

  const lastStateHashRef = useRef<string>('');
  const lastRenderTimeRef = useRef<number>(0);
  const animationFrameIdRef = useRef<number | null>(null);

  // 状態
  const [initializationComplete, setInitializationComplete] =
    useState<boolean>(false);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  // マップレンダラー
  const { renderMap } = useMapRenderer(mapContainerRef);

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
  const { centerCamera } = useCamera(appRef, {
    mapContainer: mapContainerRef,
    unitContainer: unitContainerRef,
    overlayContainer: overlayContainerRef,
  });

  // executeAbilityをuseEventHandlersに渡すためのアダプター関数
  const executeActionAdapter = executeAbility
    ? (
        sourceUnitId: string,
        targetUnitId: string,
        _targetPosition: Position,
        actionType: string
      ) => {
        console.log('アクションアダプター呼び出し:', {
          sourceUnitId,
          targetUnitId,
          actionType,
        });
        executeAbility(sourceUnitId, targetUnitId, actionType);
      }
    : undefined;

  // イベントハンドラ
  const { setupEventHandlers } = useEventHandlers(
    gameSystemRef,
    overlayContainerRef,
    mapContainerRef,
    unitContainerRef,
    selectedUnitId,
    setSelectedUnitId,
    currentActionType,
    targetSelectionMode, // 追加: 対象選択モードを渡す
    executeUnitMove,
    executeActionAdapter,
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

    // すでに初期化済みならスキップ
    if (isInitializedRef.current) {
      console.log('レンダラーはすでに初期化されています');
      return;
    }

    console.log('レンダラー初期化開始');

    const app = appRef.current;
    if (!app || !app.stage) {
      console.log('アプリまたはステージが存在しません');
      return;
    }

    // ゲームシステムの状態を確認
    const gameSystem = gameSystemRef.current;
    if (!gameSystem) {
      console.error('ゲームシステムが初期化されていません');
      return;
    }

    try {
      // 既存のコンテナが存在する場合はクリーンアップ
      if (mapContainerRef.current) {
        app.stage.removeChild(mapContainerRef.current);
        mapContainerRef.current.destroy({ children: true });
      }
      if (unitContainerRef.current) {
        app.stage.removeChild(unitContainerRef.current);
        unitContainerRef.current.destroy({ children: true });
      }
      if (overlayContainerRef.current) {
        app.stage.removeChild(overlayContainerRef.current);
        overlayContainerRef.current.destroy({ children: true });
      }

      // 新しいコンテナを作成
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
        try {
          console.log('遅延初期化の実行');

          // 状態が有効かチェック
          const state = gameSystem.getState();
          if (!state) {
            throw new Error('ゲーム状態が取得できません');
          }

          // ユニット配列が有効かチェック
          if (!state.units || !Array.isArray(state.units)) {
            throw new Error('ユニット配列が無効です');
          }

          // マップが有効かチェック
          if (!state.map) {
            throw new Error('マップが無効です');
          }

          // 初期描画
          renderMap(state);
          renderUnits(state);

          // イベントハンドラの設定は一度だけ
          setupEventHandlers();

          // 初期化完了フラグを設定
          setInitializationComplete(true);
          console.log('レンダラー初期化完了');
        } catch (error) {
          console.error('遅延初期化エラー:', error);
        }
      }, 300); // 遅延時間を少し長くする
    } catch (error) {
      console.error('レンダラー初期化エラー:', error);
    }
  }, [isAppInitialized]);

  // アクティブユニットの変更を監視して自動的にカメラをパンする
  // ゲーム状態が変更されたときの再描画をsetIntervalからrequestAnimationFrameに変更
  useEffect(() => {
    if (!isAppInitialized || !initializationComplete) return;

    console.log('ゲーム状態更新監視を開始');

    // 初期化
    lastRenderTimeRef.current = performance.now();
    const renderInterval = 500; // 500msに延長

    const renderFrame = (timestamp: number) => {
      // 一定間隔でのみレンダリング
      if (timestamp - lastRenderTimeRef.current >= renderInterval) {
        try {
          // ゲーム状態が変化した場合のみ再描画
          const gameSystem = gameSystemRef.current;
          if (gameSystem) {
            const state = gameSystem.getState();

            // 状態のハッシュ化（簡易版）- 比較に必要な部分だけを含める
            const stateHash = JSON.stringify({
              activeUnitId: state.activeUnitId,
              turnCount: state.turnCount,
              unitsPos: state.units.map((u) => ({
                id: u.id,
                x: u.position.x,
                y: u.position.y,
                hp: u.stats.hp,
                ct: u.stats.ct,
              })),
            });

            // 前回と状態が異なる場合のみ再描画
            if (stateHash !== lastStateHashRef.current) {
              console.log('状態変更を検出、再描画を実行');
              renderGameState();
              lastStateHashRef.current = stateHash;
            }
          }

          lastRenderTimeRef.current = timestamp;
        } catch (error) {
          console.error('レンダリングエラー:', error);
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(renderFrame);
    };

    // アニメーションフレームを開始
    animationFrameIdRef.current = requestAnimationFrame(renderFrame);

    return () => {
      // クリーンアップ：アニメーションフレームをキャンセル
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
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

      renderMap(state);
      renderUnits(state);

      // 描画後の確認ログ
      console.log(
        '強制再描画完了 - タイル数:',
        mapContainerRef.current?.children.length || 0,
        'ユニット数:',
        unitContainerRef.current?.children.length || 0
      );
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
    } else {
      // アビリティの場合はアクション範囲表示
      const ability = gameSystem.getAbility(actionType);
      if (ability) {
        const range = ability.range || 1;
        showActionRange(unitId, ability.type, range);
      }
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
    forceRedraw,
    isInitialized: initializationComplete,
  };
}
