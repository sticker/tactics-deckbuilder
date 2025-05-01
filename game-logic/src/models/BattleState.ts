import { TileMap } from './TileMap';
import { Unit, updateUnitCT, resetUnitCT } from './Unit';
import { Position, getDistance } from './Position';

export interface BattleState {
  map: TileMap;
  units: Unit[];
  turnCount: number;
  activeUnitId: string | null;
  tickCount: number;
}

export function createBattleState(
  mapWidth: number,
  mapHeight: number
): BattleState {
  return {
    map: new TileMap(mapWidth, mapHeight),
    units: [],
    turnCount: 0,
    activeUnitId: null,
    tickCount: 0,
  };
}

// ユニットを追加する
export function addUnit(state: BattleState, unit: Unit): BattleState {
  return {
    ...state,
    units: [...state.units, unit],
  };
}

// 指定されたIDのユニットを取得する
export function getUnitById(
  state: BattleState,
  unitId: string
): Unit | undefined {
  return state.units.find((unit) => unit.id === unitId);
}

// 指定された位置にいるユニットを取得する
export function getUnitAtPosition(
  state: BattleState,
  position: Position
): Unit | undefined {
  return state.units.find(
    (unit) => unit.position.x === position.x && unit.position.y === position.y
  );
}

// CT処理を行い、行動可能なユニットを決定する
export function processCT(state: BattleState): BattleState {
  // CTが100以上のユニットを探す
  const readyUnits = state.units.filter((unit) => unit.stats.ct >= 100);

  if (readyUnits.length > 0) {
    // CTが最も高いユニットを選択
    const activeUnit = readyUnits.reduce((highest, current) =>
      current.stats.ct > highest.stats.ct ? current : highest
    );

    return {
      ...state,
      activeUnitId: activeUnit.id,
    };
  }

  // 全ユニットのCTを更新
  const updatedUnits = state.units.map((unit) => updateUnitCT(unit));

  return {
    ...state,
    units: updatedUnits,
    tickCount: state.tickCount + 1,
  };
}

// ユニットの移動を処理する
export function moveUnitAction(
  state: BattleState,
  unitId: string,
  targetPosition: Position
): BattleState {
  const unit = getUnitById(state, unitId);
  if (!unit) {
    return state;
  }

  const tile = state.map.getTile(targetPosition);
  if (!tile || !tile.passable) {
    return state;
  }

  // 移動可能な距離かチェック
  const moveDistance = getDistance(unit.position, targetPosition);
  const maxMoveDistance = 3; // 仮の最大移動距離

  if (moveDistance > maxMoveDistance) {
    return state;
  }

  // 目標位置に他のユニットがいないかチェック
  const unitAtTarget = getUnitAtPosition(state, targetPosition);
  if (unitAtTarget) {
    return state;
  }

  // ユニットを移動させる
  const updatedUnits = state.units.map((u) =>
    u.id === unitId ? { ...u, position: { ...targetPosition } } : u
  );

  // 移動後、CTをリセットする
  const finalUnits = updatedUnits.map((u) =>
    u.id === unitId ? resetUnitCT(u) : u
  );

  return {
    ...state,
    units: finalUnits,
    activeUnitId: null,
    turnCount: state.turnCount + 1,
  };
}

// ユニットの行動可能範囲を取得する
export function getUnitMoveRange(
  state: BattleState,
  unitId: string
): Position[] {
  const unit = getUnitById(state, unitId);
  if (!unit) {
    console.log('移動範囲計算: ユニットが見つかりません', unitId);
    return [];
  }

  // ユニットの移動力を取得 (stats.movプロパティがなければデフォルト値3を使用)
  const moveRange = unit.stats.mov || 3;
  console.log(`移動範囲計算: ユニットID=${unitId}, 移動力=${moveRange}`);

  const movePositions: Position[] = [];

  // 現在のユニット位置を開始点として探索
  const visited = new Set<string>();
  const queue: { position: Position; steps: number }[] = [
    { position: { ...unit.position }, steps: 0 },
  ];

  // 移動可能な範囲を幅優先探索
  while (queue.length > 0) {
    const { position, steps } = queue.shift()!;

    // 訪問済みの場所はスキップ
    const posKey = `${position.x},${position.y}`;
    if (visited.has(posKey)) continue;

    // 訪問済みとしてマーク
    visited.add(posKey);

    // 現在地点を移動可能位置に追加（開始地点も含む）
    if (steps > 0) {
      movePositions.push({ ...position });
    }

    // 移動力を超えている場合は探索終了
    if (steps >= moveRange) continue;

    // 隣接タイルを探索
    const adjacentPositions = [
      { x: position.x, y: position.y - 1 }, // 上
      { x: position.x + 1, y: position.y }, // 右
      { x: position.x, y: position.y + 1 }, // 下
      { x: position.x - 1, y: position.y }, // 左
    ];

    for (const nextPos of adjacentPositions) {
      // マップ範囲内かチェック
      if (
        nextPos.x < 0 ||
        nextPos.x >= state.map.getWidth() ||
        nextPos.y < 0 ||
        nextPos.y >= state.map.getHeight()
      ) {
        continue;
      }

      // タイルの通行可能性をチェック
      const tile = state.map.getTile(nextPos);
      if (!tile || !tile.passable) {
        continue;
      }

      // 他のユニットが存在するかチェック（最終目的地以外）
      const hasUnit = state.units.some(
        (u) =>
          u.id !== unitId &&
          u.position.x === nextPos.x &&
          u.position.y === nextPos.y
      );

      if (hasUnit) {
        continue;
      }

      // キューに追加
      queue.push({
        position: nextPos,
        steps: steps + 1,
      });
    }
  }

  console.log(`移動範囲計算完了: ${movePositions.length}箇所`);
  return movePositions;
}
