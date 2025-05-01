// game-logic/src/models/Unit.ts

import { nanoid } from 'nanoid';
import { Position } from './Position';

export type JobType =
  | 'Knight'
  | 'Archer'
  | 'Mage'
  | 'Priest'
  | 'Rogue'
  | 'Engineer';
export type Direction = 'north' | 'east' | 'south' | 'west';

// 行動状態の追跡
export enum ActionState {
  IDLE = 'idle', // 何もしていない
  MOVED = 'moved', // 移動済み
  ACTION_USED = 'action_used', // アクション使用済み
  TURN_ENDED = 'turn_ended', // ターン終了
}

export interface UnitStats {
  hp: number;
  maxHp: number;
  atk: number; // 物理攻撃力
  def: number; // 物理防御力
  mag: number; // 魔法攻撃力
  res: number; // 魔法防御力
  spd: number; // 速度
  mov: number; // 移動力
  jmp: number; // ジャンプ力（高低差の移動可能量）
  mp: number; // MP
  maxMp: number; // 最大MP
  ct: number; // Charge Time
}

// インベントリアイテム
export interface InventoryItem {
  id: string;
  quantity: number;
}

// ユニットが装備できるアビリティスロット
export interface EquippedAbilities {
  weapon: string | null; // 武器
  magic: string[]; // 魔法（複数装備可能）
  support: string | null; // サポートアビリティ
  item: string[]; // アイテム（複数所持可能）
}

// 拡張ユニットインターフェース
export interface Unit {
  id: string;
  name: string;
  job: JobType;
  position: Position;
  direction: Direction;
  stats: UnitStats;
  teamId: number; // チームID（0: プレイヤー、1: 敵）
  actionState: ActionState; // 行動状態
  equippedAbilities: EquippedAbilities; // 装備中のアビリティ
  inventory?: { [itemId: string]: InventoryItem }; // インベントリ
  nftId?: string; // ユニットのNFT ID
}

// 拡張createUnit関数
export function createUnit(
  name: string,
  job: JobType,
  position: Position,
  teamId: number,
  direction: Direction = 'south',
  stats?: Partial<UnitStats>,
  equippedAbilities?: Partial<EquippedAbilities>
): Unit {
  // ジョブごとのデフォルトステータス
  const defaultStats: Record<JobType, UnitStats> = {
    Knight: {
      hp: 100,
      maxHp: 100,
      atk: 25,
      def: 20,
      mag: 5,
      res: 15,
      spd: 8,
      mov: 3,
      jmp: 2,
      mp: 20,
      maxMp: 20,
      ct: 0,
    },
    Archer: {
      hp: 80,
      maxHp: 80,
      atk: 20,
      def: 10,
      mag: 10,
      res: 10,
      spd: 10,
      mov: 4,
      jmp: 3,
      mp: 30,
      maxMp: 30,
      ct: 0,
    },
    Mage: {
      hp: 70,
      maxHp: 70,
      atk: 8,
      def: 5,
      mag: 30,
      res: 20,
      spd: 7,
      mov: 3,
      jmp: 2,
      mp: 60,
      maxMp: 60,
      ct: 0,
    },
    Priest: {
      hp: 75,
      maxHp: 75,
      atk: 7,
      def: 10,
      mag: 25,
      res: 25,
      spd: 9,
      mov: 3,
      jmp: 2,
      mp: 70,
      maxMp: 70,
      ct: 0,
    },
    Rogue: {
      hp: 85,
      maxHp: 85,
      atk: 22,
      def: 8,
      mag: 8,
      res: 5,
      spd: 12,
      mov: 5,
      jmp: 4,
      mp: 25,
      maxMp: 25,
      ct: 0,
    },
    Engineer: {
      hp: 90,
      maxHp: 90,
      atk: 18,
      def: 15,
      mag: 15,
      res: 15,
      spd: 9,
      mov: 3,
      jmp: 2,
      mp: 40,
      maxMp: 40,
      ct: 0,
    },
  };

  // ジョブごとのデフォルト装備
  const defaultEquipped: Record<JobType, EquippedAbilities> = {
    Knight: { weapon: 'iron_sword', magic: [], support: 'counter', item: [] },
    Archer: {
      weapon: 'short_bow',
      magic: [],
      support: 'concentrate',
      item: [],
    },
    Mage: {
      weapon: 'rod',
      magic: ['fire'],
      support: 'magic_power_up',
      item: [],
    },
    Priest: {
      weapon: 'staff',
      magic: ['cure'],
      support: 'mp_recovery',
      item: [],
    },
    Rogue: { weapon: 'dagger', magic: [], support: 'evade', item: [] },
    Engineer: { weapon: 'hammer', magic: [], support: 'repair', item: [] },
  };

  return {
    id: nanoid(),
    name,
    job,
    position,
    direction,
    teamId,
    actionState: ActionState.IDLE,
    stats: {
      ...defaultStats[job],
      ...stats,
    },
    equippedAbilities: {
      ...defaultEquipped[job],
      ...equippedAbilities,
    },
    inventory: {
      potion: { id: 'potion', quantity: 2 },
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
    actionState: ActionState.TURN_ENDED,
  };
}

// ユニットを指定された位置に移動する
export function moveUnit(unit: Unit, newPosition: Position): Unit {
  // 移動済みフラグを立てる（既にアクション使用済みならターン終了）
  const newActionState =
    unit.actionState === ActionState.ACTION_USED
      ? ActionState.TURN_ENDED
      : ActionState.MOVED;

  return {
    ...unit,
    position: { ...newPosition },
    actionState: newActionState,
  };
}

// アクションを使用した状態に更新
export function markActionUsed(unit: Unit): Unit {
  // 既に移動済みならターン終了、そうでなければアクション使用済み
  const newActionState =
    unit.actionState === ActionState.MOVED
      ? ActionState.TURN_ENDED
      : ActionState.ACTION_USED;

  return {
    ...unit,
    actionState: newActionState,
  };
}

// ターン開始時に行動状態をリセット
export function resetActionState(unit: Unit): Unit {
  return {
    ...unit,
    actionState: ActionState.IDLE,
  };
}
