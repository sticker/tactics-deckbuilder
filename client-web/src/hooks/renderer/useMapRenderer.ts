// src/hooks/renderer/useMapRenderer.ts
import { useRef, useEffect } from 'react';
import * as PIXI from 'pixi.js';
import { BattleState } from 'game-logic';
import { isoToScreen } from '../../utils/isoConversion';
import {
  TILE_WIDTH,
  TILE_HEIGHT,
  TILE_HEIGHT_OFFSET,
  COLORS,
} from '../../utils/constants';

/**
 * マップレンダリングを管理するフック
 */
export function useMapRenderer(
  mapContainerRef: React.RefObject<PIXI.Container | null>
) {
  // タイルのグラフィックスを保持する参照
  const tilesRef = useRef<Map<string, PIXI.Graphics>>(new Map());

  // 最後に描画したマップデータ
  const lastMapDataRef = useRef<any>(null);
  // マップハッシュを保存する参照を追加
  const lastMapHashRef = useRef<string>('');

  // コンポーネントのマウント/アンマウント時の処理
  useEffect(() => {
    console.log('MapRenderer: マウントされました');

    return () => {
      console.log('MapRenderer: アンマウントされています');
      // クリーンアップ
      cleanupAllTiles();
    };
  }, []);

  /**
   * マップの描画
   * @param state ゲーム状態
   */
  const renderMap = (state: BattleState) => {
    const mapContainer = mapContainerRef.current;
    if (!mapContainer) {
      console.log('マップコンテナが存在しません');
      return;
    }

    try {
      console.log('マップの描画を開始します');

      // マップデータの検証
      if (!state || !state.map) {
        console.warn('マップデータが存在しません');
        return;
      }

      const tilesData = safeGetTiles(state);

      if (!tilesData || tilesData.length === 0) {
        console.warn('タイルデータが取得できません');
        return;
      }

      // 描画前の状態確認ログ
      console.log(
        `描画前タイル数: ${mapContainer.children.length}, 描画するタイル数: ${tilesData.length}`
      );

      // 前回のマップデータと比較するためのハッシュ作成
      const mapHash = JSON.stringify(
        tilesData.map((tile) => ({
          x: tile.position.x,
          y: tile.position.y,
          h: tile.height,
          p: tile.passable,
        }))
      );

      // 強制再描画の場合はスキップしない
      const forceRender = mapContainer.children.length === 0;

      // 前回と同じマップデータなら描画をスキップ（ただしタイルが0の場合は強制描画）
      if (lastMapHashRef.current === mapHash && !forceRender) {
        console.log('マップデータに変更なし、描画スキップ');
        return;
      }

      console.log(`描画するタイル数: ${tilesData.length}`);
      lastMapHashRef.current = mapHash;

      // タイルの描画
      tilesData.forEach((tile: any) => {
        try {
          if (!tile || typeof tile !== 'object') {
            console.warn('無効なタイル情報:', tile);
            return;
          }

          const position = safeTilePosition(tile);
          if (!position) {
            console.warn('タイルの位置情報が無効です:', tile);
            return;
          }

          const tileKey = `${position.x},${position.y}`;
          let tileGraphic = tilesRef.current.get(tileKey);

          if (!tileGraphic) {
            // 新しいタイルを作成
            tileGraphic = new PIXI.Graphics();
            mapContainer.addChild(tileGraphic);
            tilesRef.current.set(tileKey, tileGraphic);
          }

          // タイルの座標をアイソメトリックに変換
          const height = safeTileHeight(tile);
          const { x, y } = isoToScreen(position, height);

          // position設定前に検証
          if (isNaN(x) || isNaN(y)) {
            console.warn(
              `無効な座標が計算されました: x=${x}, y=${y}, 位置=${JSON.stringify(
                position
              )}, 高さ=${height}`
            );
            return;
          }

          tileGraphic.position.set(x, y);

          // タイルを描画
          tileGraphic.clear();

          // タイルの側面（高さに応じて）
          if (height > 0) {
            drawTileSides(tileGraphic, height);
          }

          // タイルの上面
          drawTileTop(tileGraphic, safeTilePassable(tile));
        } catch (error) {
          console.error('タイル描画エラー:', error, 'タイル:', tile);
        }
      });

      // 描画後の確認ログ
      console.log(
        `マップ描画完了: ${tilesData.length}タイル, コンテナ内タイル数: ${mapContainer.children.length}`
      );
    } catch (error) {
      console.error('マップ描画中にエラーが発生しました:', error);
    }
  };

  /**
   * 安全にタイルのpassable状態を取得
   */
  const safeTilePassable = (tile: any): boolean => {
    if (!tile) return true;
    return typeof tile.passable === 'boolean' ? tile.passable : true;
  };

  /**
   * 安全にタイルの高さを取得
   */
  const safeTileHeight = (tile: any): number => {
    if (!tile) return 0;
    return typeof tile.height === 'number' ? tile.height : 0;
  };

  /**
   * 安全にタイルの位置を取得
   */
  const safeTilePosition = (tile: any): { x: number; y: number } | null => {
    if (!tile) return null;

    // positionプロパティがオブジェクトでなければnull
    if (!tile.position || typeof tile.position !== 'object') return null;

    // xとyが数値でなければnull
    if (
      typeof tile.position.x !== 'number' ||
      typeof tile.position.y !== 'number'
    )
      return null;

    return {
      x: tile.position.x,
      y: tile.position.y,
    };
  };

  /**
   * 安全にタイルリストを取得
   */
  const safeGetTiles = (state: BattleState): any[] => {
    try {
      if (!state || !state.map || typeof state.map.getAllTiles !== 'function') {
        return [];
      }

      const tiles = state.map.getAllTiles();
      return Array.isArray(tiles) ? tiles : [];
    } catch (error) {
      console.error('タイル取得エラー:', error);
      return [];
    }
  };

  /**
   * タイルの側面を描画
   * @param graphic グラフィックスオブジェクト
   * @param height タイルの高さ
   */
  const drawTileSides = (graphic: PIXI.Graphics, height: number) => {
    try {
      // 左側面
      graphic.beginFill(COLORS.TILE_SIDE);
      graphic.lineStyle(1, COLORS.TILE_BORDER, 1);
      graphic.drawPolygon([
        -TILE_WIDTH / 2,
        0,
        -TILE_WIDTH / 2,
        TILE_HEIGHT_OFFSET * height,
        0,
        TILE_HEIGHT / 2 + TILE_HEIGHT_OFFSET * height,
        0,
        TILE_HEIGHT / 2,
      ]);
      graphic.endFill();

      // 右側面
      graphic.beginFill(COLORS.TILE_SIDE);
      graphic.lineStyle(1, COLORS.TILE_BORDER, 1);
      graphic.drawPolygon([
        TILE_WIDTH / 2,
        0,
        TILE_WIDTH / 2,
        TILE_HEIGHT_OFFSET * height,
        0,
        TILE_HEIGHT / 2 + TILE_HEIGHT_OFFSET * height,
        0,
        TILE_HEIGHT / 2,
      ]);
      graphic.endFill();
    } catch (error) {
      console.error('タイル側面描画エラー:', error);
    }
  };

  /**
   * タイルの上面を描画
   * @param graphic グラフィックスオブジェクト
   * @param passable 通行可能かどうか
   */
  const drawTileTop = (graphic: PIXI.Graphics, passable: boolean) => {
    try {
      const fillColor = passable
        ? COLORS.TILE_PASSABLE
        : COLORS.TILE_IMPASSABLE;

      graphic.beginFill(fillColor);
      graphic.lineStyle(1, COLORS.TILE_BORDER, 1);
      graphic.drawPolygon([
        -TILE_WIDTH / 2,
        0,
        0,
        -TILE_HEIGHT / 2,
        TILE_WIDTH / 2,
        0,
        0,
        TILE_HEIGHT / 2,
      ]);
      graphic.endFill();
    } catch (error) {
      console.error('タイル上面描画エラー:', error);
    }
  };

  /**
   * 未使用のタイルをクリア
   * @param state ゲーム状態
   */
  const cleanupUnusedTiles = (state: BattleState) => {
    const mapContainer = mapContainerRef.current;
    if (!mapContainer) return;

    try {
      // 現在のマップにあるタイルのキーを収集
      const currentTileKeys = new Set<string>();
      const tiles = safeGetTiles(state);

      tiles.forEach((tile) => {
        const position = safeTilePosition(tile);
        if (position) {
          const tileKey = `${position.x},${position.y}`;
          currentTileKeys.add(tileKey);
        }
      });

      // 未使用のタイルを削除
      tilesRef.current.forEach((graphic, key) => {
        if (!currentTileKeys.has(key)) {
          mapContainer.removeChild(graphic);
          graphic.destroy();
          tilesRef.current.delete(key);
        }
      });
    } catch (error) {
      console.error('未使用タイル削除中にエラーが発生しました:', error);
    }
  };

  /**
   * すべてのタイルをクリア
   */
  const cleanupAllTiles = () => {
    const mapContainer = mapContainerRef.current;
    if (!mapContainer) return;

    try {
      console.log(
        `すべてのタイルをクリアします（現在のタイル数: ${mapContainer.children.length}）`
      );

      // 既存のタイルをすべて削除
      tilesRef.current.forEach((graphic, key) => {
        try {
          if (mapContainer.children.includes(graphic)) {
            mapContainer.removeChild(graphic);
            graphic.destroy({
              children: true,
              texture: false,
              baseTexture: false,
            });
            console.log(`タイル削除: ${key}`);
          } else {
            console.log(`タイル ${key} はすでにコンテナから削除されています`);
          }
        } catch (e) {
          console.warn('タイル削除エラー:', e);
        }
      });

      tilesRef.current.clear();
      console.log(
        `タイルクリア完了（残りタイル数: ${mapContainer.children.length}）`
      );
    } catch (error) {
      console.error('タイルクリア中にエラーが発生しました:', error);
    }
  };

  /**
   * マップコンテナのクリアと再描画
   */
  const resetAndRedraw = (state: BattleState) => {
    try {
      console.log('マップを完全に再描画します');

      // すべてのタイルをクリア
      cleanupAllTiles();

      // マップを再描画 - 強制的に実行されるよう確認
      console.log('タイルクリア後に強制再描画を実行');
      setTimeout(() => {
        renderMap(state);
        console.log(
          '再描画完了確認:',
          mapContainerRef.current?.children.length || 0
        );
      }, 0);
    } catch (error) {
      console.error('マップリセット中にエラーが発生しました:', error);
    }
  };

  /**
   * デバッグ情報の出力
   */
  const debugMapData = () => {
    try {
      console.log('== マップデバッグ情報 ==');
      console.log('マップコンテナ:', mapContainerRef.current);
      console.log('タイル数:', tilesRef.current.size);
      console.log('最後のマップデータ:', lastMapDataRef.current);

      // 最初の5つのタイルを詳細表示
      if (lastMapDataRef.current && Array.isArray(lastMapDataRef.current)) {
        console.log('タイルサンプル:');
        lastMapDataRef.current.slice(0, 5).forEach((tile, index) => {
          console.log(`[${index}]`, tile);
        });
      }
    } catch (error) {
      console.error('デバッグ情報出力エラー:', error);
    }
  };

  return {
    renderMap,
    cleanupUnusedTiles,
    resetAndRedraw,
    debugMapData, // デバッグ用
  };
}
