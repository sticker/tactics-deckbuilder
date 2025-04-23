import { nanoid } from 'nanoid';
import { Position } from './Position';

export type JobType = 'Knight' | 'Archer' | 'Mage' | 'Priest' | 'Rogue' | 'Engineer';

export interface UnitStats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  ct: number; // Charge Time
}

export interface Unit {
  id: string;
  name: string;
  job: JobType;
  position: Position;
  stats: UnitStats;
  teamId: number; // チームID（0: プレイヤー、1: 敵）
}

export function createUnit(
  name: string,
  job: JobType,
  position: Position,
  teamId: number,
  stats?: Partial<UnitStats>
): Unit {
  // ジョブごとのデフォルトステータス
  const defaultStats: Record<JobType, UnitStats> = {
    Knight: { hp: 100, maxHp: 100, atk: 25, def: 20, spd: 8, ct: 0 },
    Archer: { hp: 80, maxHp: 80, atk: 20, def: 10, spd: 10, ct: 0 },
    Mage: { hp: 70, maxHp: 70, atk: 30, def: 5, spd: 7, ct: 0 },
    Priest: { hp: 75, maxHp: 75, atk: 15, def: 10, spd: 9, ct: 0 },
    Rogue: { hp: 85, maxHp: 85, atk: 22, def: 8, spd: 12, ct: 0 },
    Engineer: { hp: 90, maxHp: 90, atk: 18, def: 15, spd: 9, ct: 0 },
  };

  return {
    id: nanoid(),
    name,
    job,
    position,
    teamId,
    stats: {
      ...defaultStats[job],
      ...stats,
    },
  };
}

// ユニットのCTを更新する
export function updateUnitCT(unit: Unit, tick: number = 1): Unit {
  const newCt = unit.stats.ct + unit.stats.spd * tick;
  return {
    ...unit,
    stats: {
      ...unit.stats,
      ct: newCt,
    },
  };
}

// ユニットのCTをリセットする
export function resetUnitCT(unit: Unit): Unit {
  return {
    ...unit,
    stats: {
      ...unit.stats,
      ct: 0,
    },
  };
}

// ユニットを指定された位置に移動する
export function moveUnit(unit: Unit, newPosition: Position): Unit {
  return {
    ...unit,
    position: { ...newPosition },
  };
}
