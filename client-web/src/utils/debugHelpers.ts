// src/utils/debugHelpers.ts
import * as PIXI from 'pixi.js';
import { GameSystem } from 'game-logic';

/**
 * ゲームシステムの状態を詳細に診断するためのデバッグヘルパー
 */
export function debugGameSystem(gameSystem: GameSystem | null) {
  if (!gameSystem) {
    console.error('デバッグ対象のゲームシステムがnullです');
    return;
  }

  try {
    console.group('===== ゲームシステムの診断 =====');

    // ゲームシステムの状態を取得
    const state = gameSystem.getState();

    // 基本情報
    console.log('基本情報:');
    console.log('- ターン数:', state.turnCount);
    console.log('- ティック数:', state.tickCount);
    console.log('- アクティブユニットID:', state.activeUnitId);

    // マップ情報
    console.log('マップ情報:');
    if (state.map) {
      console.log(
        '- マップサイズ:',
        state.map.getWidth(),
        'x',
        state.map.getHeight()
      );

      // マップメソッドのチェック
      const hasGetAllTiles = typeof state.map.getAllTiles === 'function';
      const hasGetTile = typeof state.map.getTile === 'function';
      console.log(
        '- getAllTiles メソッド:',
        hasGetAllTiles ? '存在します' : '存在しません'
      );
      console.log(
        '- getTile メソッド:',
        hasGetTile ? '存在します' : '存在しません'
      );

      // タイル情報のチェック
      if (hasGetAllTiles) {
        try {
          const tiles = state.map.getAllTiles();
          console.log('- タイル数:', tiles.length);

          // サンプルタイル
          if (tiles.length > 0) {
            const sampleTile = tiles[0];
            console.log('- サンプルタイル:', sampleTile);
            console.log('  - position存在:', !!sampleTile.position);
            if (sampleTile.position) {
              console.log('  - position型:', typeof sampleTile.position);
              console.log('  - x:', sampleTile.position.x);
              console.log('  - y:', sampleTile.position.y);
            }
            console.log('  - height:', sampleTile.height);
            console.log('  - passable:', sampleTile.passable);
          }
        } catch (e) {
          console.error('タイル情報取得エラー:', e);
        }
      }
    } else {
      console.warn('マップオブジェクトが存在しません');
    }

    // ユニット情報
    console.log('ユニット情報:');
    console.log('- ユニット数:', state.units.length);

    // サンプルユニット
    if (state.units.length > 0) {
      const sampleUnit = state.units[0];
      console.log('- サンプルユニット:', sampleUnit);
      console.log('  - ID:', sampleUnit.id);
      console.log('  - 名前:', sampleUnit.name);
      console.log('  - チーム:', sampleUnit.teamId);
      console.log('  - position存在:', !!sampleUnit.position);
      if (sampleUnit.position) {
        console.log('  - position型:', typeof sampleUnit.position);
        console.log('  - x:', sampleUnit.position.x);
        console.log('  - y:', sampleUnit.position.y);
      }
    }

    // 主要メソッドの存在確認
    console.log('メソッドチェック:');
    console.log(
      '- setupInitialState:',
      typeof gameSystem.setupInitialState === 'function'
    );
    console.log('- processTick:', typeof gameSystem.processTick === 'function');
    console.log(
      '- executeAction:',
      typeof gameSystem.executeAction === 'function'
    );
    console.log('- moveUnit:', typeof gameSystem.moveUnit === 'function');
    console.log(
      '- getUnitMoveRange:',
      typeof gameSystem.getUnitMoveRange === 'function'
    );

    console.groupEnd();
  } catch (error) {
    console.error('ゲームシステム診断中にエラーが発生しました:', error);
  }
}

/**
 * コンテナの状態を診断
 */
export function debugContainers(
  mapContainer: PIXI.Container | null,
  unitContainer: PIXI.Container | null,
  overlayContainer: PIXI.Container | null
) {
  console.group('===== コンテナの診断 =====');

  // マップコンテナ
  console.log('マップコンテナ:');
  console.log('- 存在:', !!mapContainer);
  if (mapContainer) {
    console.log('- 子要素数:', mapContainer.children.length);
    console.log('- 位置:', mapContainer.position.x, mapContainer.position.y);
    console.log('- 表示状態:', mapContainer.visible);
    console.log('- アルファ値:', mapContainer.alpha);
  }

  // ユニットコンテナ
  console.log('ユニットコンテナ:');
  console.log('- 存在:', !!unitContainer);
  if (unitContainer) {
    console.log('- 子要素数:', unitContainer.children.length);
    console.log('- 位置:', unitContainer.position.x, unitContainer.position.y);
    console.log('- 表示状態:', unitContainer.visible);
    console.log('- アルファ値:', unitContainer.alpha);
  }

  // オーバーレイコンテナ
  console.log('オーバーレイコンテナ:');
  console.log('- 存在:', !!overlayContainer);
  if (overlayContainer) {
    console.log('- 子要素数:', overlayContainer.children.length);
    console.log(
      '- 位置:',
      overlayContainer.position.x,
      overlayContainer.position.y
    );
    console.log('- 表示状態:', overlayContainer.visible);
    console.log('- アルファ値:', overlayContainer.alpha);
    console.log('- イベントモード:', overlayContainer.eventMode);
    console.log('- カーソル:', overlayContainer.cursor);
  }

  console.groupEnd();
}

/**
 * ゲームシステムの状態を初期化またはリセットする
 */
export function forceInitializeGameSystem(gameSystem: GameSystem | null) {
  if (!gameSystem) {
    console.error('初期化対象のゲームシステムがnullです');
    return false;
  }

  try {
    console.log('ゲームシステムを強制的に初期化します');

    // setupInitialStateメソッドが存在すれば呼び出す
    if (typeof gameSystem.setupInitialState === 'function') {
      gameSystem.setupInitialState();
      console.log('ゲームシステムの初期化が完了しました');
      return true;
    } else {
      console.error('setupInitialStateメソッドが見つかりません');
      return false;
    }
  } catch (error) {
    console.error('ゲームシステム初期化中にエラーが発生しました:', error);
    return false;
  }
}

/**
 * デバッグ用のダミーマップを生成
 */
export function generateDebugMap(width: number = 5, height: number = 5): any[] {
  const tiles: any[] = [];

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      tiles.push({
        position: { x, y },
        height: Math.floor(Math.random() * 3), // 0-2のランダムな高さ
        passable: true,
      });
    }
  }

  return tiles;
}
