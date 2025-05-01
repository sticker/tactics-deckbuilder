// src/hooks/renderer/useUnitRenderer.ts

import { useRef } from 'react';
import * as PIXI from 'pixi.js';
import { BattleState } from 'game-logic';
import { isoToScreen } from '../../utils/isoConversion';
import { TILE_WIDTH, TILE_HEIGHT } from '../../utils/constants';
import { Direction } from 'game-logic/src/models/Unit';

// スプライト画像を管理するためのキャッシュ
const spriteTextureCache: Record<string, PIXI.Texture> = {};

/**
 * スプライトテクスチャのロードと取得
 * @param job ジョブタイプ
 * @param direction 向き
 * @param teamId チームID
 */
function getUnitTexture(
  job: string,
  direction: Direction,
  teamId: number
): PIXI.Texture {
  // スプライトのキー（ジョブタイプと向きの組み合わせ）
  const spriteKey = `${job.toLowerCase()}_${teamId}_${direction}`;

  // キャッシュにあればそれを返す
  if (spriteTextureCache[spriteKey]) {
    return spriteTextureCache[spriteKey];
  }

  // キャッシュになければ新しく作成
  try {
    // スプライトのパス
    const spritePath = `/assets/sprites/${job.toLowerCase()}/${direction}.png`;
    const texture = PIXI.Texture.from(spritePath);

    // 読み込みエラー対応
    texture.on('error', () => {
      console.warn(`スプライト読み込みエラー: ${spritePath}`);
      // フォールバックとして向き別デフォルト画像を使用
      spriteTextureCache[spriteKey] = PIXI.Texture.from(
        `/assets/sprites/default/${direction}.png`
      );
    });

    // キャッシュに保存
    spriteTextureCache[spriteKey] = texture;
    return texture;
  } catch (error) {
    console.error('テクスチャロードエラー:', error);
    // エラー時はデフォルトテクスチャを返す
    return PIXI.Texture.WHITE;
  }
}

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
          actionState: unit.actionState, // 行動状態も追加
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

          if (!unitSprite) {
            // 新しいスプライトを作成
            const texture = getUnitTexture(unit.job, direction, unit.teamId);
            unitSprite = new PIXI.Sprite(texture);

            // スプライトの設定
            unitSprite.anchor.set(0.5, 0.75); // 足元中心に設定

            // サイズを固定 - タイルサイズに合わせて調整
            const fixedWidth = TILE_WIDTH * 1.5; // タイル幅の1.5倍の幅
            const fixedHeight = TILE_HEIGHT * 2.5; // タイル高さの2.5倍の高さ

            // 幅と高さを直接設定
            unitSprite.width = fixedWidth;
            unitSprite.height = fixedHeight;

            unitContainer.addChild(unitSprite);
            unitsRef.current.set(unit.id, unitSprite);
            console.log(`新しいユニットスプライトを作成: ${unit.id}`);
          } else {
            // 既存のスプライトの場合、向きに応じてテクスチャを更新
            unitSprite.texture = getUnitTexture(
              unit.job,
              direction,
              unit.teamId
            );

            // テクスチャが変わっても固定サイズを維持
            const fixedWidth = TILE_WIDTH * 1.5;
            const fixedHeight = TILE_HEIGHT * 2.5;
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
            unitSprite.tint = 0xffffff; // 本来のスプライト色
          }

          // 行動状態に応じた表示
          switch (unit.actionState) {
            case 'moved':
              // 移動済み（やや暗く）
              unitSprite.alpha = 0.8;
              break;
            case 'action_used':
              // アクション使用済み（さらに暗く）
              unitSprite.alpha = 0.7;
              break;
            case 'turn_ended':
              // ターン終了（かなり暗く）
              unitSprite.alpha = 0.5;
              break;
            default:
              // 待機中（通常）
              unitSprite.alpha = 1.0;
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
