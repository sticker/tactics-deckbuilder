// game-logic/src/models/Ability.ts
import { Position } from './Position';
import { Unit } from './Unit';
import { BattleState } from './BattleState';

// アビリティの種類
export enum AbilityType {
  WEAPON = 'weapon', // 武器（物理攻撃）
  MAGIC = 'magic', // 魔法（魔法攻撃・回復等）
  ITEM = 'item', // アイテム（消費品）
  PASSIVE = 'passive', // パッシブ効果
}

// アビリティの対象種別
export enum TargetType {
  SINGLE_ENEMY = 'single_enemy', // 単体敵
  SINGLE_ALLY = 'single_ally', // 単体味方
  SINGLE_ANY = 'single_any', // 単体（敵味方問わず）
  AREA_ENEMY = 'area_enemy', // 範囲敵
  AREA_ALLY = 'area_ally', // 範囲味方
  AREA_ANY = 'area_any', // 範囲（敵味方問わず）
  SELF = 'self', // 自分自身
}

// 属性
export enum Element {
  NONE = 'none',
  FIRE = 'fire',
  ICE = 'ice',
  THUNDER = 'thunder',
  WIND = 'wind',
  EARTH = 'earth',
  HOLY = 'holy',
  DARK = 'dark',
}

// アビリティのインターフェース
export interface Ability {
  id: string; // アビリティID
  name: string; // 名前
  description: string; // 説明
  type: AbilityType; // アビリティの種類
  targetType: TargetType; // 対象タイプ
  range: number; // 射程距離
  areaSize?: number; // 範囲サイズ（範囲攻撃の場合）
  power: number; // 威力・効果量
  element: Element; // 属性
  castTime: number; // 詠唱時間（CT）
  cooldown: number; // クールダウン
  mpCost?: number; // MP消費量（魔法の場合）
  uses?: number; // 使用回数（アイテムの場合）
  iconPath: string; // アイコン画像パス

  // NFT関連のプロパティ
  tokenId?: string; // NFTトークンID
  rarity: string; // レアリティ

  // 条件判定メソッド
  canUse: (user: Unit, state: BattleState) => boolean;

  // 対象選択の検証
  validateTarget: (
    user: Unit,
    target: Unit | Position,
    state: BattleState
  ) => boolean;

  // 効果適用
  execute: (
    user: Unit,
    target: Unit | Position,
    state: BattleState
  ) => BattleState;
}

// アビリティファクトリ関数
export function createAbility(
  params: Partial<Ability> & { id: string; name: string; type: AbilityType }
): Ability {
  // デフォルト値
  const defaultAbility: Ability = {
    id: params.id,
    name: params.name,
    description: '',
    type: params.type,
    targetType: TargetType.SINGLE_ENEMY,
    range: 1,
    power: 10,
    element: Element.NONE,
    castTime: 0,
    cooldown: 0,
    iconPath: `/assets/abilities/${params.type}_default.png`,
    rarity: 'common',

    // 未使用変数を_prefixで宣言して警告を回避
    canUse: (_user, _state) => true,
    validateTarget: (_user, _target, _state) => true,
    execute: (_user, _target, state) => state,
  };

  // パラメータをマージ
  return { ...defaultAbility, ...params };
}

// 武器アビリティの作成
export function createWeaponAbility(
  id: string,
  name: string,
  power: number,
  element: Element = Element.NONE,
  range: number = 1,
  description: string = ''
): Ability {
  return createAbility({
    id,
    name,
    description: description || `${name}で攻撃する`,
    type: AbilityType.WEAPON,
    targetType: TargetType.SINGLE_ENEMY,
    range,
    power,
    element,
    castTime: 0,
    cooldown: 0,
    iconPath: `/assets/abilities/weapons/${id}.png`,

    canUse: (user, _state) => user.stats.hp > 0,

    validateTarget: (user, target, _state) => {
      console.log('武器アビリティ検証:', {
        user: user.id,
        targetType: typeof target,
        hasId: 'id' in target,
      });

      if (!(target instanceof Object) || !('id' in target)) {
        console.log('ターゲットがユニットではありません');
        return false; // 対象がユニットでない
      }

      const targetUnit = target as Unit;
      console.log('チーム比較:', user.teamId, targetUnit.teamId);

      if (targetUnit.teamId === user.teamId) {
        console.log('味方は攻撃できません');
        return false; // 味方は攻撃できない
      }

      // 距離をチェック
      const distance =
        Math.abs(user.position.x - targetUnit.position.x) +
        Math.abs(user.position.y - targetUnit.position.y);
      console.log('距離チェック:', distance, '許容範囲:', range);
      return distance <= range;
    },

    execute: (user, target, state) => {
      if (!(target instanceof Object) || !('id' in target)) {
        return state;
      }

      const targetUnit = target as Unit;

      // ダメージ計算
      const damage = Math.max(
        1,
        user.stats.atk + power - targetUnit.stats.def / 2
      );

      // ダメージ適用
      const updatedUnits = state.units.map((unit) => {
        if (unit.id === targetUnit.id) {
          const newHp = Math.max(0, unit.stats.hp - damage);
          return {
            ...unit,
            stats: {
              ...unit.stats,
              hp: newHp,
            },
          };
        }
        return unit;
      });

      return {
        ...state,
        units: updatedUnits,
      };
    },
  });
}

// 魔法アビリティの作成
export function createMagicAbility(
  id: string,
  name: string,
  power: number,
  element: Element,
  targetType: TargetType,
  range: number,
  castTime: number,
  mpCost: number,
  description: string = ''
): Ability {
  return createAbility({
    id,
    name,
    description: description || `${element}属性の魔法で攻撃する`,
    type: AbilityType.MAGIC,
    targetType,
    range,
    power,
    element,
    castTime,
    cooldown: 1,
    mpCost,
    iconPath: `/assets/abilities/magic/${id}.png`,

    canUse: (user, _state) => user.stats.hp > 0 && user.stats.mp >= mpCost,

    validateTarget: (user, target, _state) => {
      console.log('魔法アビリティ検証:', {
        user: user.id,
        targetType: typeof target,
        hasId: typeof target === 'object' && 'id' in target,
      });

      // 対象がユニットか位置か確認
      if (!(target instanceof Object)) {
        console.log('ターゲットがオブジェクトではありません');
        return false;
      }

      // 単体対象の場合
      if (targetType.startsWith('single_')) {
        if (!('id' in target)) {
          console.log('単一ターゲットがユニットではありません');
          return false; // 対象がユニットでない
        }

        const targetUnit = target as Unit;
        console.log('チーム比較:', user.teamId, targetUnit.teamId);

        // 対象タイプに応じたチェック
        if (
          targetType === TargetType.SINGLE_ENEMY &&
          targetUnit.teamId === user.teamId
        ) {
          console.log('敵対象スキルで味方が選択されました');
          return false; // 敵対象なのに味方を選択
        }
        if (
          targetType === TargetType.SINGLE_ALLY &&
          targetUnit.teamId !== user.teamId
        ) {
          console.log('味方対象スキルで敵が選択されました');
          return false; // 味方対象なのに敵を選択
        }

        // 距離をチェック
        const distance =
          Math.abs(user.position.x - targetUnit.position.x) +
          Math.abs(user.position.y - targetUnit.position.y);
        console.log('距離チェック:', distance, '許容範囲:', range);
        return distance <= range;
      }

      // 範囲対象とその他の場合は一旦trueを返す（実装簡略化のため）
      return true;
    },

    execute: (user, target, state) => {
      // MPを消費
      const updatedUser = {
        ...user,
        stats: {
          ...user.stats,
          mp: user.stats.mp - mpCost,
        },
      };

      // 単体対象の場合
      if (targetType.startsWith('single_') && 'id' in target) {
        const targetUnit = target as Unit;

        // 攻撃か回復かを判定（敵対象なら攻撃、味方対象なら回復と仮定）
        const isHeal =
          targetType === TargetType.SINGLE_ALLY ||
          (targetType === TargetType.SINGLE_ANY &&
            targetUnit.teamId === user.teamId);

        // 効果量計算
        let effectValue = power;
        if (!isHeal) {
          // 攻撃の場合、魔力と防御を考慮
          effectValue = Math.max(
            1,
            user.stats.mag + power - targetUnit.stats.res / 2
          );
        }

        // 効果適用
        const updatedUnits = state.units.map((unit) => {
          if (unit.id === updatedUser.id) {
            return updatedUser; // MP消費反映
          }
          if (unit.id === targetUnit.id) {
            let newHp;
            if (isHeal) {
              // 回復
              newHp = Math.min(unit.stats.maxHp, unit.stats.hp + effectValue);
            } else {
              // ダメージ
              newHp = Math.max(0, unit.stats.hp - effectValue);
            }

            return {
              ...unit,
              stats: {
                ...unit.stats,
                hp: newHp,
              },
            };
          }
          return unit;
        });

        return {
          ...state,
          units: updatedUnits,
        };
      }

      // 範囲対象の場合（実装簡略化のため、単体対象と同様の処理）
      return {
        ...state,
        units: state.units.map((unit) =>
          unit.id === user.id ? updatedUser : unit
        ),
      };
    },
  });
}

// アイテムアビリティの作成（型問題を修正）
export function createItemAbility(
  id: string,
  name: string,
  effect: (
    user: Unit,
    target: Unit | Position,
    state: BattleState
  ) => BattleState,
  targetType: TargetType = TargetType.SINGLE_ALLY,
  range: number = 1,
  uses: number = 1,
  description: string = ''
): Ability {
  return createAbility({
    id,
    name,
    description: description || `${name}を使用する`,
    type: AbilityType.ITEM,
    targetType,
    range,
    power: 0, // アイテムは効果関数で処理
    element: Element.NONE,
    castTime: 0,
    cooldown: 0,
    uses,
    iconPath: `/assets/abilities/items/${id}.png`,

    canUse: (user, _state) => {
      if (!user.inventory) return false;
      return user.stats.hp > 0 && (user.inventory[id]?.quantity || 0) > 0;
    },

    validateTarget: (user, target, _state) => {
      // 対象がユニットか確認
      if (!(target instanceof Object) || !('id' in target)) {
        return false;
      }

      const targetUnit = target as Unit;

      // 対象タイプに応じたチェック
      if (
        targetType === TargetType.SINGLE_ENEMY &&
        targetUnit.teamId === user.teamId
      ) {
        return false;
      }
      if (
        targetType === TargetType.SINGLE_ALLY &&
        targetUnit.teamId !== user.teamId
      ) {
        return false;
      }
      if (targetType === TargetType.SELF && targetUnit.id !== user.id) {
        return false;
      }

      // 距離をチェック
      const distance =
        Math.abs(user.position.x - targetUnit.position.x) +
        Math.abs(user.position.y - targetUnit.position.y);
      return distance <= range;
    },

    execute: (user, target, state) => {
      // ユーザーに有効なインベントリがなければ状態を変更せず返す
      if (!user.inventory || !user.inventory[id]) {
        return state;
      }

      // インベントリから使用数を減らす処理
      const updatedInventory = { ...user.inventory };
      updatedInventory[id] = {
        id: id,
        quantity: Math.max(0, (user.inventory[id].quantity || 1) - 1),
      };

      // ユーザーのインベントリを更新
      const userWithUpdatedInventory: Unit = {
        ...user,
        inventory: updatedInventory,
      };

      // カスタム効果関数を実行
      const stateAfterEffect = effect(userWithUpdatedInventory, target, state);

      // ユーザーのインベントリ更新を反映
      return {
        ...stateAfterEffect,
        units: stateAfterEffect.units.map((unit) =>
          unit.id === user.id ? userWithUpdatedInventory : unit
        ),
      };
    },
  });
}

// サンプルアビリティの定義
export const SampleAbilities = {
  // 武器
  MithrilSword: createWeaponAbility(
    'mithril_sword',
    'ミスリルソード',
    15,
    Element.NONE,
    1,
    '鋼鉄を超える硬度と切れ味を持つミスリル製の剣'
  ),

  // 魔法
  Fireball: createMagicAbility(
    'fireball',
    'ファイアーボール',
    20,
    Element.FIRE,
    TargetType.SINGLE_ENEMY,
    3, // 射程距離
    50, // キャストタイム
    5, // MP消費
    '炎の球を飛ばし、対象に火属性ダメージを与える'
  ),

  Healing: createMagicAbility(
    'healing',
    'ヒーリング',
    25,
    Element.HOLY,
    TargetType.SINGLE_ALLY,
    3, // 射程距離
    30, // キャストタイム
    8, // MP消費
    '神聖な力で対象のHPを回復する'
  ),

  // アイテム
  Potion: createItemAbility(
    'potion',
    'ポーション',
    (_user, target, state) => {
      // userパラメータに_プレフィックスを追加
      // 対象がユニットか確認
      if (!('id' in target)) {
        return state;
      }

      const targetUnit = target as Unit;
      const healAmount = 30;

      // 回復を適用
      return {
        ...state,
        units: state.units.map((unit) => {
          if (unit.id === targetUnit.id) {
            const newHp = Math.min(
              unit.stats.maxHp,
              unit.stats.hp + healAmount
            );
            return {
              ...unit,
              stats: {
                ...unit.stats,
                hp: newHp,
              },
            };
          }
          return unit;
        }),
      };
    },
    TargetType.SINGLE_ALLY,
    1,
    1,
    '体力を30回復する薬'
  ),
};

// アビリティコレクションの型
export type AbilityCollection = {
  [key: string]: Ability;
};
