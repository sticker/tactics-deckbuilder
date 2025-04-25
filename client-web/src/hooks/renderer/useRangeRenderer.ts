// src/hooks/renderer/useRangeRenderer.ts
import { useRef } from 'react';
import * as PIXI from 'pixi.js';
import { GameSystem } from 'game-logic';
import { isoToScreen, isInActionRange } from '../../utils/isoConversion';
import { TILE_WIDTH, TILE_HEIGHT, COLORS } from '../../utils/constants';

/**
 * 移動範囲とアクション範囲の表示を管理するフック
 */
export function useRangeRenderer(
  gameSystemRef: React.RefObject<GameSystem | null>,
  overlayContainerRef: React.RefObject<PIXI.Container | null>
) {
  // 移動範囲と行動範囲のグラフィックスを保持する参照
  const moveRangeRef = useRef<PIXI.Graphics[]>([]);
  const actionRangeRef = useRef<PIXI.Graphics[]>([]);

  /**
   * 移動可能範囲の表示
   * @param unitId ユニットID
   */
  const showMoveRange = (unitId: string) => {
    console.log('移動可能範囲を表示:', unitId);
    const gameSystem = gameSystemRef.current;
    const overlayContainer = overlayContainerRef.current;
    if (!gameSystem || !overlayContainer) return;

    // 以前の移動範囲表示をクリア
    clearMoveRange();

    // ユニットがアクティブ（移動可能）かどうか判定
    const state = gameSystem.getState();
    const isActive = state.activeUnitId === unitId;

    // 色を選択：アクティブなら緑、非アクティブならオレンジ
    const fillColor = isActive
      ? COLORS.MOVE_RANGE_ACTIVE
      : COLORS.MOVE_RANGE_INACTIVE;
    const lineColor = isActive
      ? COLORS.MOVE_RANGE_ACTIVE
      : COLORS.MOVE_RANGE_INACTIVE;

    // 移動可能範囲を取得
    const movePositions = gameSystem.getUnitMoveRange(unitId);
    console.log('移動可能範囲:', movePositions);

    // 移動可能範囲を描画
    movePositions.forEach((position) => {
      const tile = gameSystem.getState().map.getTile(position);
      const height = tile ? tile.height : 0;
      const { x, y } = isoToScreen(position, height);

      const rangeMarker = new PIXI.Graphics();
      rangeMarker.beginFill(fillColor, 0.3); // 半透明の塗りつぶし
      rangeMarker.lineStyle(2, lineColor, 0.8); // 線スタイル
      rangeMarker.drawPolygon([
        -TILE_WIDTH / 2,
        0,
        0,
        -TILE_HEIGHT / 2,
        TILE_WIDTH / 2,
        0,
        0,
        TILE_HEIGHT / 2,
      ]);
      rangeMarker.endFill();
      rangeMarker.position.set(x, y);

      overlayContainer.addChild(rangeMarker);
      moveRangeRef.current.push(rangeMarker);
    });

    // ユニットが非アクティブな場合、通知を表示
    if (!isActive && movePositions.length > 0) {
      if (window.showGameNotification) {
        window.showGameNotification('このユニットはまだ行動できません');
      }
    }
  };

  /**
   * 移動可能範囲表示のクリア
   */
  const clearMoveRange = () => {
    const overlayContainer = overlayContainerRef.current;
    if (!overlayContainer) return;

    moveRangeRef.current.forEach((marker) => {
      overlayContainer.removeChild(marker);
      marker.destroy();
    });
    moveRangeRef.current = [];
  };

  /**
   * アクション範囲表示関数
   * @param unitId ユニットID
   * @param actionType アクションタイプ（attack/heal）
   * @param range 範囲
   */
  const showActionRange = (
    unitId: string,
    actionType: string,
    range: number = 1
  ) => {
    console.log('アクション範囲表示:', actionType, range, unitId);
    const gameSystem = gameSystemRef.current;
    const overlayContainer = overlayContainerRef.current;
    if (!gameSystem || !overlayContainer) return;

    // 既存の範囲表示をクリア
    clearActionRange();
    clearMoveRange(); // 移動範囲も消去

    // アクション範囲の色
    const fillColor =
      actionType === 'attack' ? COLORS.ATTACK_RANGE : COLORS.HEAL_RANGE;
    const lineColor =
      actionType === 'attack' ? COLORS.ATTACK_RANGE : COLORS.HEAL_RANGE;
    const alpha = 0.3;

    // ユニットの位置を取得
    const unit = gameSystem.getState().units.find((u) => u.id === unitId);
    if (!unit) return;

    // マップを取得
    const state = gameSystem.getState();
    const map = state.map;

    // アクション可能なタイルを検索
    for (let y = 0; y < map.getHeight(); y++) {
      for (let x = 0; x < map.getWidth(); x++) {
        const position = { x, y };
        const tile = map.getTile(position);

        if (!tile || !tile.passable) continue;

        // マンハッタン距離でアクション範囲をチェック
        if (isInActionRange(unit.position, position, range)) {
          // 対象位置にユニットがいるか確認
          const targetUnit = state.units.find(
            (u) => u.position.x === x && u.position.y === y
          );

          // ユニットがいる場所のみ表示（自分自身を除く）
          if (targetUnit && targetUnit.id !== unit.id) {
            // 範囲表示用のグラフィックスを作成
            const { x: screenX, y: screenY } = isoToScreen(
              position,
              tile.height
            );
            const rangeGraphic = new PIXI.Graphics();

            rangeGraphic.beginFill(fillColor, alpha);
            rangeGraphic.lineStyle(2, lineColor, 0.8);
            rangeGraphic.drawPolygon([
              -TILE_WIDTH / 2,
              0,
              0,
              -TILE_HEIGHT / 2,
              TILE_WIDTH / 2,
              0,
              0,
              TILE_HEIGHT / 2,
            ]);
            rangeGraphic.endFill();
            rangeGraphic.position.set(screenX, screenY);

            overlayContainer.addChild(rangeGraphic);
            actionRangeRef.current.push(rangeGraphic);
          }
        }
      }
    }

    if (actionRangeRef.current.length === 0) {
      // 範囲内に対象がいない場合
      if (window.showGameNotification) {
        window.showGameNotification(
          'アクション可能なユニットが範囲内にいません'
        );
      }
    }
  };

  /**
   * アクション範囲表示のクリア
   */
  const clearActionRange = () => {
    const overlayContainer = overlayContainerRef.current;
    if (!overlayContainer) return;

    actionRangeRef.current.forEach((graphic) => {
      overlayContainer.removeChild(graphic);
      graphic.destroy();
    });

    actionRangeRef.current = [];
  };

  /**
   * 全ての範囲表示をクリア
   */
  const clearAllRanges = () => {
    clearMoveRange();
    clearActionRange();
  };

  return {
    showMoveRange,
    clearMoveRange,
    showActionRange,
    clearActionRange,
    clearAllRanges,
  };
}
