// src/hooks/renderer/useUnitRenderer.ts

import { useRef } from 'react';
import * as PIXI from 'pixi.js';
import { BattleState } from 'game-logic';
import { isoToScreen } from '../../utils/isoConversion';
import { TILE_WIDTH, TILE_HEIGHT } from '../../utils/constants';

/**
 * ユニットレンダリングを管理するフック
 */
export function useUnitRenderer(
  unitContainerRef: React.RefObject<PIXI.Container | null>,
  selectedUnitId: string | null
) {
  // ユニットのスプライトを保持する参照（ここを変更）
  const unitsRef = useRef<Map<string, PIXI.Sprite>>(new Map());

  // ユニットハッシュを保存する参照
  const lastUnitsHashRef = useRef<string>('');

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
      // ユニットデータのハッシュ作成
      const unitsHash = JSON.stringify(
        state.units.map((unit) => ({
          id: unit.id,
          x: unit.position.x,
          y: unit.position.y,
          hp: unit.stats.hp,
          ct: unit.stats.ct,
          active: unit.id === state.activeUnitId,
          selected: unit.id === selectedUnitId,
          direction: unit.direction || 'south', // 方向情報を追加
        }))
      );

      // 前回と同じユニットデータなら描画をスキップ
      if (lastUnitsHashRef.current === unitsHash) {
        return;
      }

      console.log('ユニット描画開始: ' + state.units.length + '体');
      lastUnitsHashRef.current = unitsHash;

      // 現在のユニットをクリア（存在しないユニットのスプライトを削除）
      unitsRef.current.forEach((sprite, id) => {
        if (!state.units.some((unit) => unit.id === id)) {
          try {
            unitContainer.removeChild(sprite);
            sprite.destroy();
            unitsRef.current.delete(id);
          } catch (error) {
            console.error('ユニット削除エラー:', error);
          }
        }
      });

      // ユニットの描画
      state.units.forEach((unit) => {
        try {
          // 重要: unit と position の null チェックを強化
          if (!unit) {
            console.warn('ユニットがnullです');
            return;
          }

          if (
            !unit.position ||
            typeof unit.position.x !== 'number' ||
            typeof unit.position.y !== 'number'
          ) {
            console.warn('無効なユニット位置:', unit.id, unit.position);
            return;
          }

          let unitSprite = unitsRef.current.get(unit.id);

          // ユニットの向き（デフォルトは南向き）
          const direction = unit.direction || 'south';

          // スプライトのキー（ジョブタイプと向きの組み合わせ）
          const spriteKey = `${unit.job}_${direction}`;

          if (!unitSprite) {
            // 新しいスプライトを作成
            const texture = PIXI.Texture.from(
              `/assets/sprites/${spriteKey}.png`
            );
            unitSprite = new PIXI.Sprite(texture);

            // スプライトの設定
            unitSprite.anchor.set(0.5, 0.75); // 足元中心に設定

            // サイズを固定 - タイルサイズに合わせて調整
            const fixedWidth = TILE_WIDTH * 1.2; // タイル幅の1.2倍の幅
            const fixedHeight = TILE_HEIGHT * 2; // タイル高さの2倍の高さ

            // 幅と高さを直接設定
            unitSprite.width = fixedWidth;
            unitSprite.height = fixedHeight;

            unitContainer.addChild(unitSprite);
            unitsRef.current.set(unit.id, unitSprite);
            console.log(`新しいユニットスプライトを作成: ${unit.id}`);
          } else {
            // 既存のスプライトの場合、向きに応じてテクスチャを更新
            unitSprite.texture = PIXI.Texture.from(
              `/assets/sprites/${spriteKey}.png`
            );

            // テクスチャが変わっても固定サイズを維持
            const fixedWidth = TILE_WIDTH * 1.2;
            const fixedHeight = TILE_HEIGHT * 2;
            unitSprite.width = fixedWidth;
            unitSprite.height = fixedHeight;
          }

          // タイルの座標をアイソメトリックに変換
          const tile =
            state.map && state.map.getTile
              ? state.map.getTile(unit.position)
              : null;
          const height = tile ? tile.height : 0;
          const { x, y } = isoToScreen(unit.position, height);

          // NaN チェックを追加
          if (isNaN(x) || isNaN(y)) {
            console.warn(
              `無効な座標が計算されました: ユニットID=${
                unit.id
              }, 位置=${JSON.stringify(unit.position)}`
            );
            return;
          }

          unitSprite.position.set(x, y);

          // チームによって色合いを変える（オプション）
          const teamTint = unit.teamId === 0 ? 0xffffff : 0xffdddd;

          // ユニットが選択されているか、行動可能かによって強調表示
          const isSelected = unit.id === selectedUnitId;
          const isActive = unit.id === state.activeUnitId;

          if (isSelected) {
            // 選択状態（黄色いハイライト）
            unitSprite.tint = 0xffff99;
          } else if (isActive) {
            // アクティブ状態（青白いハイライト）
            unitSprite.tint = 0xaaffff;
          } else {
            // 通常状態（チームカラー）
            unitSprite.tint = teamTint;
          }

        } catch (error) {
          console.error('ユニット描画エラー:', error, 'ユニット:', unit);
        }
      });

      console.log('ユニット描画完了');
    } catch (error) {
      console.error('ユニット描画中にエラーが発生しました:', error);
    }
  };

  // redrawAllUnits関数も対応して修正する必要があります
  const redrawAllUnits = (state: BattleState) => {
    const unitContainer = unitContainerRef.current;
    if (!unitContainer) return;

    try {
      console.log('全ユニットを再描画します');

      // 既存のユニットをすべて削除
      unitsRef.current.forEach((sprite) => {
        unitContainer.removeChild(sprite);
        sprite.destroy();
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
