// src/utils/isoConversion.ts
import { Position } from 'game-logic';
import { TILE_WIDTH, TILE_HEIGHT, TILE_HEIGHT_OFFSET } from './constants';

/**
 * アイソメトリック座標をスクリーン座標に変換
 * @param position ゲームの位置座標（グリッド座標）
 * @param height タイルの高さ
 * @returns スクリーン上の座標
 */
export function isoToScreen(
  position: Position,
  height: number = 0
): { x: number; y: number } {
  return {
    x: ((position.x - position.y) * TILE_WIDTH) / 2,
    y:
      ((position.x + position.y) * TILE_HEIGHT) / 2 -
      height * TILE_HEIGHT_OFFSET,
  };
}

/**
 * スクリーン座標からアイソメトリック座標に変換
 * @param screenX スクリーンX座標
 * @param screenY スクリーンY座標
 * @returns ゲームのグリッド座標
 */
export function screenToIso(screenX: number, screenY: number): Position {
  // タイルの菱形形状を考慮した計算式に修正
  const isoX = Math.floor(
    (screenX / (TILE_WIDTH / 2) + screenY / (TILE_HEIGHT / 2)) / 2
  );
  const isoY = Math.floor(
    (screenY / (TILE_HEIGHT / 2) - screenX / (TILE_WIDTH / 2)) / 2
  );
  return { x: isoX, y: isoY };
}

/**
 * タイルクリック判定
 * @param screenX スクリーンX座標
 * @param screenY スクリーンY座標
 * @param tileX タイルX座標
 * @param tileY タイルY座標
 * @param tileHeight タイルの高さ
 * @returns タイルがクリックされたかどうか
 */
export function isTileHit(
  screenX: number,
  screenY: number,
  tileX: number,
  tileY: number,
  tileHeight: number
): boolean {
  // タイルの中心座標を計算
  const { x: centerX, y: centerY } = isoToScreen(
    { x: tileX, y: tileY },
    tileHeight
  );

  // クリック点とタイル中心との差分
  const dx = screenX - centerX;
  const dy = screenY - centerY;

  // 菱形の判定を行う（アイソメトリック座標系では菱形になる）
  return (
    Math.abs(dx / (TILE_WIDTH / 2)) + Math.abs(dy / (TILE_HEIGHT / 2)) <= 1
  );
}

/**
 * 2点間の線形補間関数
 * @param start 開始値
 * @param end 終了値
 * @param t 補間値（0〜1）
 * @returns 補間結果
 */
export function lerp(start: number, end: number, t: number): number {
  return start + t * (end - start);
}

/**
 * 2地点間の線形パスを計算
 * @param start 開始位置
 * @param end 終了位置
 * @param steps 分割ステップ数
 * @returns パス（位置の配列）
 */
export function calculateLinearPath(
  start: Position,
  end: Position,
  steps: number
): Position[] {
  const path: Position[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    path.push({
      x: lerp(start.x, end.x, t),
      y: lerp(start.y, end.y, t),
    });
  }
  return path;
}

/**
 * マンハッタン距離を計算
 * @param a 位置A
 * @param b 位置B
 * @returns マンハッタン距離
 */
export function manhattanDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * マンハッタン距離でアクション範囲内かをチェック
 * @param sourcePosition 発動元の位置
 * @param targetPosition ターゲットの位置
 * @param range 範囲
 * @returns 範囲内の場合true
 */
export function isInActionRange(
  sourcePosition: Position,
  targetPosition: Position,
  range: number
): boolean {
  const distance = manhattanDistance(sourcePosition, targetPosition);
  return distance <= range && distance > 0; // 自分自身を除外するためdistance > 0
}
