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

export function createBattleState(mapWidth: number, mapHeight: number): BattleState {
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
export function getUnitById(state: BattleState, unitId: string): Unit | undefined {
  return state.units.find((unit) => unit.id === unitId);
}

// 指定された位置にいるユニットを取得する
export function getUnitAtPosition(state: BattleState, position: Position): Unit | undefined {
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
export function moveUnitAction(state: BattleState, unitId: string, targetPosition: Position): BattleState {
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
export function getUnitMoveRange(state: BattleState, unitId: string): Position[] {
  const unit = getUnitById(state, unitId);
  if (!unit) {
    return [];
  }

  const movePositions: Position[] = [];
  const maxMoveDistance = 3; // 仮の最大移動距離

  // マップ全体を走査
  for (let y = 0; y < state.map.getHeight(); y++) {
    for (let x = 0; x < state.map.getWidth(); x++) {
      const position = { x, y };
      const tile = state.map.getTile(position);
      
      // タイルが存在し、通行可能であり、他のユニットがいない場合
      if (
        tile && 
        tile.passable && 
        !getUnitAtPosition(state, position) &&
        getDistance(unit.position, position) <= maxMoveDistance
      ) {
        movePositions.push(position);
      }
    }
  }

  return movePositions;
}