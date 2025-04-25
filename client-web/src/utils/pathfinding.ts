// src/utils/pathfinding.ts
import { Position, BattleState } from 'game-logic';
import { calculateLinearPath, manhattanDistance } from './isoConversion';

/**
 * A*アルゴリズムによるパス検索
 * @param state ゲーム状態
 * @param start 開始位置
 * @param end 目標位置
 * @returns 計算されたパス（位置の配列）
 */
export function findPath(
  state: BattleState,
  start: Position,
  end: Position
): Position[] {
  // 開始位置と目標位置が同じ場合
  if (start.x === end.x && start.y === end.y) {
    return [{ ...start }];
  }

  // 開始位置または目標位置が無効な場合
  if (!isValidPosition(start) || !isValidPosition(end)) {
    console.error('パス検索: 無効な開始位置または目標位置');
    return [];
  }

  try {
    // すでに調査済みのノード
    const closedSet = new Set<string>();

    // 現在調査中のノード
    const openSet = new Set<string>();
    openSet.add(`${start.x},${start.y}`);

    // 各ノードへの最適経路のスコア
    const gScore: Record<string, number> = {};
    gScore[`${start.x},${start.y}`] = 0;

    // 各ノードの推定スコア
    const fScore: Record<string, number> = {};
    fScore[`${start.x},${start.y}`] = manhattanDistance(start, end);

    // 各ノードの親ノード
    const cameFrom: Record<string, Position> = {};

    // 隣接ノードの方向を定義
    const directions = [
      { x: 0, y: -1 }, // 上
      { x: 1, y: 0 }, // 右
      { x: 0, y: 1 }, // 下
      { x: -1, y: 0 }, // 左
    ];

    // 最大探索回数（無限ループ防止）
    const maxIterations = 1000;
    let iterations = 0;

    // openSetが空になるまで探索を続ける
    while (openSet.size > 0 && iterations < maxIterations) {
      iterations++;

      // fScoreが最小のノードを取得
      let currentKey = '';
      let currentScore = Infinity;

      for (const key of openSet) {
        if (fScore[key] !== undefined && fScore[key] < currentScore) {
          currentScore = fScore[key];
          currentKey = key;
        }
      }

      // 現在のノードの座標を取得
      const [x, y] = currentKey.split(',').map(Number);
      const current: Position = { x, y };

      // 目標地点に到達したかチェック
      if (current.x === end.x && current.y === end.y) {
        // ゴールに到達、パスを再構成
        return reconstructPath(cameFrom, current);
      }

      // 現在のノードを処理済みに
      openSet.delete(currentKey);
      closedSet.add(currentKey);

      // 隣接ノードをチェック
      for (const dir of directions) {
        const neighbor: Position = {
          x: current.x + dir.x,
          y: current.y + dir.y,
        };

        // 無効な隣接ノードの場合はスキップ
        if (!isValidNeighbor(state, neighbor, start, end)) {
          continue;
        }

        const neighborKey = `${neighbor.x},${neighbor.y}`;

        // 処理済みのノードはスキップ
        if (closedSet.has(neighborKey)) {
          continue;
        }

        // 現在のノードを経由したスコアを計算
        const tentativeGScore = gScore[currentKey] + 1;

        // 未調査のノードか、より良い経路を発見した場合
        if (
          !openSet.has(neighborKey) ||
          tentativeGScore < gScore[neighborKey]
        ) {
          // 経路を更新
          cameFrom[neighborKey] = current;
          gScore[neighborKey] = tentativeGScore;
          fScore[neighborKey] =
            tentativeGScore + manhattanDistance(neighbor, end);

          // 未調査なら調査対象に追加
          if (!openSet.has(neighborKey)) {
            openSet.add(neighborKey);
          }
        }
      }
    }

    // パスが見つからなかった場合のフォールバック（直線パス）
    console.warn(
      'A*でパスが見つかりませんでした。直線パスにフォールバックします。'
    );
    return calculateLinearPath(
      start,
      end,
      Math.max(Math.abs(end.x - start.x), Math.abs(end.y - start.y)) + 1
    );
  } catch (error) {
    console.error('パス検索エラー:', error);
    // エラー時は空のパスを返す
    return [];
  }
}

/**
 * パスを再構成する
 * @param cameFrom 各ノードの親ノード
 * @param current 現在のノード
 * @returns 構築されたパス
 */
function reconstructPath(
  cameFrom: Record<string, Position>,
  current: Position
): Position[] {
  const path: Position[] = [];
  let curr = current;

  while (curr) {
    path.unshift({ ...curr });
    const key = `${curr.x},${curr.y}`;
    curr = cameFrom[key];
  }

  return path;
}

/**
 * 座標が有効かチェック
 * @param position 座標
 * @returns 有効な座標ならtrue
 */
function isValidPosition(position: Position): boolean {
  return (
    position && typeof position.x === 'number' && typeof position.y === 'number'
  );
}

/**
 * 隣接ノードが有効かチェック
 * @param state ゲーム状態
 * @param neighbor 隣接ノード
 * @param start 開始位置
 * @param end 目標位置
 * @returns 有効な隣接ノードならtrue
 */
function isValidNeighbor(
  state: BattleState,
  neighbor: Position,
  start: Position,
  end: Position
): boolean {
  // マップ範囲外の場合
  if (
    neighbor.x < 0 ||
    neighbor.y < 0 ||
    neighbor.x >= state.map.getWidth() ||
    neighbor.y >= state.map.getHeight()
  ) {
    return false;
  }

  // 通行不能タイルの場合
  const neighborTile = state.map.getTile(neighbor);
  if (!neighborTile || !neighborTile.passable) {
    return false;
  }

  // そのタイルにユニットがいるか確認
  const unitAtPos = state.units.find(
    (u) => u.position.x === neighbor.x && u.position.y === neighbor.y
  );

  if (unitAtPos) {
    // 移動元のユニットと同じ位置
    const startUnitId = state.units.find(
      (u) => u.position.x === start.x && u.position.y === start.y
    )?.id;

    if (unitAtPos.id !== startUnitId) {
      // 目的地の場合は許可（ユニット入れ替え用）
      if (!(neighbor.x === end.x && neighbor.y === end.y)) {
        return false;
      }
    }
  }

  return true;
}
