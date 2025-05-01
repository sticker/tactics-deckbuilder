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
import { ActionState } from 'game-logic/src/models/Unit';

const GameCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<PIXI.Application | null>(null);
  const gameSystemRef = useRef<GameSystem | null>(null);
  const [appInitialized, setAppInitialized] = useState(false);
  const [_, setForceUpdate] = useState(0);
  const [currentAbilityId, setCurrentAbilityId] = useState<string | null>(null);
  const [targetSelectionMode, setTargetSelectionMode] =
    useState<boolean>(false);

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
        width: canvasRef.current.clientWidth || 800,
        height: canvasRef.current.clientHeight || 600,
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

      // 一度だけ初期状態を設定
      try {
        console.log('ゲームシステムの初期状態を設定中...');
        gameSystem.setupInitialState();

        // 初期状態が正しく設定されたか確認
        const state = gameSystem.getState();
        if (!state || !state.units || state.units.length === 0) {
          throw new Error('ゲームシステムの初期状態が正しく設定されていません');
        }

        // 各ユニットにpositionがあるか確認
        for (const unit of state.units) {
          if (
            !unit.position ||
            typeof unit.position.x !== 'number' ||
            typeof unit.position.y !== 'number'
          ) {
            throw new Error(
              `ユニット ${unit.id} の位置が正しく設定されていません`
            );
          }
        }

        console.log(
          'ゲームシステムの初期状態設定完了:',
          state.units.length,
          'ユニット初期化済み'
        );
      } catch (error) {
        console.error('初期状態設定エラー:', error);
        return; // 初期化に失敗した場合は処理を中断
      }

      // 参照を保存
      appRef.current = app;
      gameSystemRef.current = gameSystem;

      // デバッグモードキーイベントリスナーの設定
      window.addEventListener('keydown', handleDebugKeyDown);

      console.log('ゲーム初期化完了');
      setAppInitialized(true);
    } catch (error) {
      console.error('ゲーム初期化エラー:', error);
    }

    return () => {
      // クリーンアップ処理
      if (appRef.current) {
        appRef.current.destroy(true, { children: true });
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

  // アビリティ実行処理
  const executeAbility = (
    sourceUnitId: string,
    targetUnitId: string,
    abilityId: string
  ) => {
    if (!gameSystemRef.current) return;

    console.log(`アビリティ実行開始: ${abilityId}`, sourceUnitId, targetUnitId);

    const gameSystem = gameSystemRef.current;

    // アビリティを実行
    const result = gameSystem.executeAbility(
      sourceUnitId,
      abilityId,
      targetUnitId
    );

    if (result.success) {
      console.log(`${abilityId}アビリティ成功!`);
      if (window.showGameNotification) {
        window.showGameNotification(`${abilityId}を実行しました！`);
      }
    } else {
      console.log('アビリティ実行失敗:', result.reason);

      // エラー理由に応じたメッセージを表示
      if (window.showGameNotification) {
        let errorMessage = 'アビリティの実行に失敗しました';

        if (result.reason === 'not_active_unit') {
          errorMessage = 'このユニットは現在行動できません';
        } else if (result.reason === 'target_out_of_range') {
          errorMessage = '対象が範囲外です';
        } else if (result.reason === 'target_unit_not_found') {
          errorMessage = '対象のユニットが見つかりません';
        } else if (result.reason === 'cannot_use_ability') {
          errorMessage = 'このアビリティは現在使用できません';
        }

        window.showGameNotification(errorMessage);
      }
    }

    // 状態をリセット
    setCurrentAbilityId(null);
    setTargetSelectionMode(false);

    // アクション実行後に強制的に再レンダリング
    setTimeout(() => {
      handleStateUpdate();
    }, 100);
  };

  // ユニット移動の実行処理
  // 移動の実行処理
  const executeUnitMove = (unitId: string, targetPosition: Position) => {
    if (!gameSystemRef.current) return;

    console.log(`ユニット移動実行: ${unitId} -> `, targetPosition);

    const gameSystem = gameSystemRef.current;
    const state = gameSystem.getState();

    // 移動前にアクティブユニットかどうか、行動状態をチェック
    const unit = state.units.find((u) => u.id === unitId);

    if (!unit) {
      console.log('ユニットが見つかりません');
      return;
    }

    if (state.activeUnitId !== unitId) {
      console.log('このユニットは現在行動できません');
      if (window.showGameNotification) {
        window.showGameNotification('このユニットは現在行動できません');
      }
      return;
    }

    if (
      unit.actionState === ActionState.MOVED ||
      unit.actionState === ActionState.ACTION_USED ||
      unit.actionState === ActionState.TURN_ENDED
    ) {
      console.log('このユニットはすでに行動済みです');
      if (window.showGameNotification) {
        window.showGameNotification('このユニットはすでに行動済みです');
      }
      return;
    }

    const success = gameSystem.moveUnit(unitId, targetPosition);

    if (success) {
      console.log('移動成功');
      if (window.showGameNotification) {
        window.showGameNotification('移動完了');
      }

      // 必要に応じてサーバーに移動を通知
      if (moveUnit) {
        moveUnit(unitId, targetPosition);
      }

      // 選択状態もクリア
      setSelectedUnitId(null);

      // 状態更新通知 - 重要：これで UI に状態変化を反映させる
      handleStateUpdate();
    } else {
      console.log('移動失敗');
      if (window.showGameNotification) {
        window.showGameNotification('移動失敗');
      }
    }
  };

  // ゲームレンダラーのセットアップ（アプリ初期化後のみ）
  const {
    selectedUnitId,
    setSelectedUnitId,
    handleActionSelect,
    forceRedraw,
    isInitialized,
  } = useGameRenderer(
    appRef,
    gameSystemRef,
    appInitialized,
    currentAbilityId,
    targetSelectionMode, // 追加: 対象選択モードを渡す
    connectionState,
    executeUnitMove,
    executeAbility
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

  // アビリティ選択のハンドラー
  const onAbilitySelect = (abilityId: string, unitId: string) => {
    if (!gameSystemRef.current) return;

    console.log(`アビリティ選択: ${abilityId} (ユニット: ${unitId})`);

    // 空文字の場合は選択解除
    if (!abilityId) {
      setCurrentAbilityId(null);
      setTargetSelectionMode(false);
      return;
    }

    const gameSystem = gameSystemRef.current;
    const state = gameSystem.getState();
    const unit = state.units.find((u) => u.id === unitId);

    if (!unit) return;

    // パスの場合は特別処理
    if (abilityId === 'pass') {
      handleActionPass(unit.id);
      return;
    }

    // 選択済みのアビリティを再度クリックした場合は選択解除
    if (currentAbilityId === abilityId) {
      console.log('アビリティ選択解除');
      setCurrentAbilityId(null);
      setTargetSelectionMode(false);
      return;
    }

    const ability = gameSystem.getAbility(abilityId);

    if (!unit || !ability) return;

    // 選択済みのアビリティを再度クリックした場合は選択解除
    if (currentAbilityId === abilityId) {
      console.log('アビリティ選択解除');
      setCurrentAbilityId(null);
      setTargetSelectionMode(false);
      return;
    }

    // ユニットが行動可能かチェック
    if (
      state.activeUnitId !== unitId ||
      unit.actionState === ActionState.ACTION_USED ||
      unit.actionState === ActionState.TURN_ENDED
    ) {
      console.log('このユニットは現在このアビリティを使用できません');
      if (window.showGameNotification) {
        window.showGameNotification(
          'このユニットは現在このアビリティを使用できません'
        );
      }
      return;
    }

    // アビリティが使用可能かチェック
    if (!ability.canUse(unit, state)) {
      console.log('このアビリティは現在使用できません');
      if (window.showGameNotification) {
        window.showGameNotification('このアビリティは現在使用できません');
      }
      return;
    }

    // 現在のアビリティをセット
    console.log('アビリティをセット:', abilityId);
    setCurrentAbilityId(abilityId);
    setTargetSelectionMode(true);

    // アクション選択ハンドラを呼び出し
    handleActionSelect(abilityId, unitId);
  };

  // アクションパス処理
  const handleActionPass = (unitId: string) => {
    if (!gameSystemRef.current) return;

    const gameSystem = gameSystemRef.current;
    const state = gameSystem.getState();

    // アクティブユニットかチェック
    if (state.activeUnitId !== unitId) {
      console.log('このユニットは現在行動できません');
      if (window.showGameNotification) {
        window.showGameNotification('このユニットは現在行動できません');
      }
      return;
    }

    // 行動をパスし、アクション済み状態に更新
    const unit = state.units.find((u) => u.id === unitId);
    if (!unit) return;

    // アクション使用済みとしてマーク
    const result = gameSystem.markActionUsed(unitId);

    if (result.success) {
      console.log('アクションパス成功');
      if (window.showGameNotification) {
        window.showGameNotification('アクションをパスしました');
      }
    } else {
      console.log('アクションパス失敗:', result.reason);
      if (window.showGameNotification) {
        window.showGameNotification('アクションパスに失敗しました');
      }
    }

    // 状態をリセット
    setCurrentAbilityId(null);
    setTargetSelectionMode(false);

    // 状態更新通知
    handleStateUpdate();
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
        onActionSelect={onAbilitySelect}
        currentAbilityId={currentAbilityId}
      />

      {/* ターゲット選択モード表示 */}
      {targetSelectionMode && currentAbilityId && (
        <div className='absolute top-24 left-1/2 transform -translate-x-1/2 bg-indigo-900 bg-opacity-90 text-white px-4 py-2 rounded-md shadow-lg z-20 text-center'>
          対象を選択してください
        </div>
      )}

      {renderDebugUI()}
    </div>
  );
};

export default GameCanvas;
