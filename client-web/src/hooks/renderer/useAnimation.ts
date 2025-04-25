// src/hooks/renderer/useAnimation.ts
import { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { Position, BattleState, GameSystem } from 'game-logic';
import { isoToScreen, lerp } from '../../utils/isoConversion';
import {
  UNIT_MOVE_BASE_DURATION,
} from '../../utils/constants';

// 移動アニメーション用の型定義
interface AnimatingUnit {
  unitId: string;
  path: Position[];
  currentStep: number;
  totalSteps: number;
  startTime: number;
  duration: number; // 移動全体の所要時間（ミリ秒）
  stepDuration: number; // 1ステップあたりの所要時間（ミリ秒）
  onComplete: () => void;
}

/**
 * アニメーション管理フック
 */
export function useAnimation(
  gameSystemRef: React.RefObject<GameSystem | null>,
  unitsRef: React.RefObject<Map<string, PIXI.Graphics>>
) {
  // アニメーション中のユニットリスト
  const animatingUnitsRef = useRef<AnimatingUnit[]>([]);
  // アニメーションフレームID
  const animationFrameIdRef = useRef<number | null>(null);

  // コンポーネントのアンマウント時にアニメーションを停止
  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current !== null) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, []);

  /**
   * ユニット移動アニメーションの開始
   * @param unitId ユニットID
   * @param path 移動パス
   * @param duration アニメーション所要時間
   * @param onComplete 完了時コールバック
   */
  const startMoveAnimation = (
    unitId: string,
    path: Position[],
    duration: number = UNIT_MOVE_BASE_DURATION,
    onComplete?: () => void
  ) => {
    console.log('移動アニメーション開始:', unitId, path);

    // パスのバリデーション
    if (!path || path.length <= 1) {
      console.log('無効なパス、アニメーションをスキップ');
      if (onComplete) onComplete();
      return;
    }

    // 不正な値が含まれていないか確認
    const validPath = path.filter(
      (pos) => pos && typeof pos.x === 'number' && typeof pos.y === 'number'
    );

    if (validPath.length !== path.length) {
      console.warn('不正な位置データがパスに含まれています。修正します。');
    }

    if (validPath.length <= 1) {
      console.log('有効なパスポイントが不足、アニメーションをスキップ');
      if (onComplete) onComplete();
      return;
    }

    const now = performance.now();
    const stepDuration = duration / (validPath.length - 1);

    // アニメーション情報を登録
    const animatingUnit: AnimatingUnit = {
      unitId,
      path: validPath,
      currentStep: 0,
      totalSteps: validPath.length - 1,
      startTime: now,
      duration,
      stepDuration,
      onComplete: onComplete || (() => {}),
    };

    // 既存のアニメーションを削除（同じユニットが複数回移動しないように）
    animatingUnitsRef.current = animatingUnitsRef.current.filter(
      (anim) => anim.unitId !== unitId
    );

    // アニメーション中のユニットリストに追加
    animatingUnitsRef.current.push(animatingUnit);

    // アニメーションループが未起動なら開始
    if (animationFrameIdRef.current === null) {
      animationFrameIdRef.current = requestAnimationFrame(updateAnimations);
    }
  };

  /**
   * アニメーションの更新
   * @param timestamp タイムスタンプ
   */
  const updateAnimations = (timestamp: number) => {
    const gameSystem = gameSystemRef.current;
    if (!gameSystem) {
      animationFrameIdRef.current = requestAnimationFrame(updateAnimations);
      return;
    }

    let hasActiveAnimations = false;
    const state = gameSystem.getState();

    // 各アニメーション中のユニットを更新
    for (let i = animatingUnitsRef.current.length - 1; i >= 0; i--) {
      try {
        const anim = animatingUnitsRef.current[i];

        // パスが空または無効なら処理をスキップ
        if (!anim || !anim.path || anim.path.length === 0) {
          console.error('無効なアニメーションデータ:', anim);
          animatingUnitsRef.current.splice(i, 1);
          continue;
        }

        const elapsed = timestamp - anim.startTime;

        // 総経過時間から現在のステップを計算
        const currentStep = Math.min(
          Math.floor(elapsed / anim.stepDuration),
          anim.totalSteps
        );

        // アニメーション完了判定
        if (currentStep >= anim.totalSteps) {
          // 最終位置に設定
          updateUnitToFinalPosition(anim, state);

          // 完了コールバックを呼び出し
          if (anim.onComplete) {
            anim.onComplete();
          }

          // リストから削除
          animatingUnitsRef.current.splice(i, 1);
        } else {
          hasActiveAnimations = true;

          // 現在のステップと次のステップの間を補間
          updateUnitPosition(anim, currentStep, elapsed, state);
        }
      } catch (error) {
        console.error('アニメーション更新エラー:', error);
        // エラーが発生したアニメーションは削除
        animatingUnitsRef.current.splice(i, 1);
      }
    }

    // アニメーションがまだ残っている場合は続行
    if (hasActiveAnimations) {
      animationFrameIdRef.current = requestAnimationFrame(updateAnimations);
    } else {
      animationFrameIdRef.current = null;
    }
  };

  /**
   * ユニットを最終位置に更新
   * @param anim アニメーション情報
   * @param state ゲーム状態
   */
  const updateUnitToFinalPosition = (
    anim: AnimatingUnit,
    state: BattleState
  ) => {
    const unit = state.units.find((u) => u.id === anim.unitId);
    const unitGraphic = unitsRef.current?.get(anim.unitId);

    if (unit && unitGraphic && anim.path.length > 0) {
      const endPos = anim.path[anim.path.length - 1];
      const tile = state.map.getTile(endPos);
      const height = tile ? tile.height : 0;
      const { x, y } = isoToScreen(endPos, height);
      unitGraphic.position.set(x, y);
    }
  };

  /**
   * ユニット位置を更新
   * @param anim アニメーション情報
   * @param currentStep 現在のステップ
   * @param elapsed 経過時間
   * @param state ゲーム状態
   */
  const updateUnitPosition = (
    anim: AnimatingUnit,
    currentStep: number,
    elapsed: number,
    state: BattleState
  ) => {
    // 現在のステップと次のステップの間を補間
    if (currentStep < anim.path.length - 1) {
      const unit = state.units.find((u) => u.id === anim.unitId);
      const unitGraphic = unitsRef.current?.get(anim.unitId);

      if (unit && unitGraphic) {
        // 安全にインデックスをチェック
        if (
          currentStep >= 0 &&
          currentStep < anim.path.length &&
          currentStep + 1 < anim.path.length
        ) {
          const currentPos = anim.path[currentStep];
          const nextPos = anim.path[currentStep + 1];

          // パス位置の有効性を確認
          if (
            currentPos &&
            nextPos &&
            typeof currentPos.x === 'number' &&
            typeof currentPos.y === 'number' &&
            typeof nextPos.x === 'number' &&
            typeof nextPos.y === 'number'
          ) {
            // ステップ内での進行度を計算（0〜1）
            const stepProgress =
              (elapsed % anim.stepDuration) / anim.stepDuration;

            // 2点間を線形補間
            const interpPos = {
              x: lerp(currentPos.x, nextPos.x, stepProgress),
              y: lerp(currentPos.y, nextPos.y, stepProgress),
            };

            // 高さを考慮した座標を計算
            const currentTile = state.map.getTile(currentPos);
            const nextTile = state.map.getTile(nextPos);
            const currentHeight =
              currentTile && typeof currentTile.height === 'number'
                ? currentTile.height
                : 0;
            const nextHeight =
              nextTile && typeof nextTile.height === 'number'
                ? nextTile.height
                : 0;

            // 高さも補間
            const interpHeight = lerp(currentHeight, nextHeight, stepProgress);

            // ユニットのバウンス効果（軽いジャンプ感）
            const bounceHeight = Math.sin(stepProgress * Math.PI) * 8;

            // 画面座標に変換して位置を更新
            const { x, y } = isoToScreen(interpPos, interpHeight);
            unitGraphic.position.set(x, y - bounceHeight);
          }
        }
      }
    }
  };

  return {
    startMoveAnimation,
    hasAnimatingUnits: () => animatingUnitsRef.current.length > 0,
  };
}
