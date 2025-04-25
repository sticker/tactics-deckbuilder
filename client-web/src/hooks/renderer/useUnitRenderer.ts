// src/hooks/renderer/useUnitRenderer.ts
import { useRef } from 'react';
import * as PIXI from 'pixi.js';
import { BattleState } from 'game-logic';
import { isoToScreen } from '../../utils/isoConversion';
import { TILE_WIDTH, TILE_HEIGHT, COLORS } from '../../utils/constants';

/**
 * ユニットレンダリングを管理するフック
 */
export function useUnitRenderer(
  unitContainerRef: React.RefObject<PIXI.Container | null>,
  selectedUnitId: string | null
) {
  // ユニットのグラフィックスを保持する参照
  const unitsRef = useRef<Map<string, PIXI.Graphics>>(new Map());

  /**
   * ユニットの描画
   * @param state ゲーム状態
   */
  const renderUnits = (state: BattleState) => {
    const unitContainer = unitContainerRef.current;
    if (!unitContainer) {
      console.warn('ユニットコンテナが存在しません');
      return;
    }

    try {
      console.log('ユニット描画開始: ' + state.units.length + '体');

      // 現在のユニットをクリア（存在しないユニットのグラフィックスを削除）
      unitsRef.current.forEach((graphic, id) => {
        if (!state.units.some((unit) => unit.id === id)) {
          try {
            unitContainer.removeChild(graphic);
            graphic.destroy();
            unitsRef.current.delete(id);
          } catch (error) {
            console.error('ユニット削除エラー:', error);
          }
        }
      });

      // ユニットの描画
      state.units.forEach((unit) => {
        try {
          if (!unit || !unit.position) {
            console.warn('無効なユニット情報:', unit);
            return;
          }

          let unitGraphic = unitsRef.current.get(unit.id);

          if (!unitGraphic) {
            // 新しいユニットを作成
            unitGraphic = new PIXI.Graphics();
            unitContainer.addChild(unitGraphic);
            unitsRef.current.set(unit.id, unitGraphic);
            console.log(`新しいユニットを作成: ${unit.id}`);
          }

          // タイルの座標をアイソメトリックに変換
          const tile = state.map.getTile(unit.position);
          const height = tile ? tile.height : 0;
          const { x, y } = isoToScreen(unit.position, height);

          unitGraphic.position.set(x, y);

          // ユニットを描画
          unitGraphic.clear();

          // チームによって色を変える
          const teamColor =
            unit.teamId === 0 ? COLORS.TEAM_BLUE : COLORS.TEAM_RED;

          // ユニットが選択されているか、行動可能かによって強調表示
          const isSelected = unit.id === selectedUnitId;
          const isActive = unit.id === state.activeUnitId;
          const borderColor = isSelected
            ? COLORS.SELECTED
            : isActive
            ? COLORS.ACTIVE
            : COLORS.DEFAULT_BORDER;
          const borderWidth = isSelected || isActive ? 3 : 1;

          // ユニットの描画（円形で表現）
          unitGraphic.beginFill(teamColor, 0.8);
          unitGraphic.lineStyle(borderWidth, borderColor, 1);
          unitGraphic.drawCircle(0, -TILE_HEIGHT / 4, TILE_WIDTH / 4);
          unitGraphic.endFill();

          // CTゲージの描画
          drawChargeTimeBar(unitGraphic, unit.stats.ct);

          // HPバーの描画
          drawHealthBar(unitGraphic, unit.stats.hp, unit.stats.maxHp);
        } catch (error) {
          console.error('ユニット描画エラー:', error, 'ユニット:', unit);
        }
      });

      console.log('ユニット描画完了');
    } catch (error) {
      console.error('ユニット描画中にエラーが発生しました:', error);
    }
  };

  /**
   * CTゲージの描画
   * @param graphic グラフィックスオブジェクト
   * @param chargeTime 現在のCT値
   */
  const drawChargeTimeBar = (graphic: PIXI.Graphics, chargeTime: number) => {
    try {
      const ctRatio = chargeTime / 100;
      graphic.beginFill(0xffcc44, 0.8);
      graphic.lineStyle(1, 0x000000, 0.8);
      graphic.drawRect(
        -TILE_WIDTH / 5,
        -TILE_HEIGHT / 2,
        (TILE_WIDTH / 2.5) * ctRatio,
        5
      );
      graphic.endFill();
    } catch (error) {
      console.error('CTゲージ描画エラー:', error);
    }
  };

  /**
   * HPバーの描画
   * @param graphic グラフィックスオブジェクト
   * @param currentHp 現在のHP
   * @param maxHp 最大HP
   */
  const drawHealthBar = (
    graphic: PIXI.Graphics,
    currentHp: number,
    maxHp: number
  ) => {
    try {
      const hpRatio = currentHp / maxHp;
      graphic.beginFill(0x44ff44, 0.8);
      graphic.lineStyle(1, 0x000000, 0.8);
      graphic.drawRect(
        -TILE_WIDTH / 5,
        -TILE_HEIGHT / 2 + 7,
        (TILE_WIDTH / 2.5) * hpRatio,
        5
      );
      graphic.endFill();
    } catch (error) {
      console.error('HPバー描画エラー:', error);
    }
  };

  /**
   * すべてのユニットを再描画
   */
  const redrawAllUnits = (state: BattleState) => {
    const unitContainer = unitContainerRef.current;
    if (!unitContainer) return;

    try {
      console.log('全ユニットを再描画します');

      // 既存のユニットをすべて削除
      unitsRef.current.forEach((graphic) => {
        unitContainer.removeChild(graphic);
        graphic.destroy();
      });
      unitsRef.current.clear();

      // ユニットを再描画
      renderUnits(state);
    } catch (error) {
      console.error('ユニット再描画中にエラーが発生しました:', error);
    }
  };

  return {
    renderUnits,
    redrawAllUnits,
    unitsRef,
  };
}
