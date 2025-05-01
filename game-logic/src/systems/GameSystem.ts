// game-logic/src/systems/GameSystem.ts

import {
  BattleState,
  createBattleState,
  addUnit,
  processCT,
  getUnitMoveRange,
  getUnitById,
} from '../models/BattleState';
import {
  createUnit,
  JobType,
  Unit,
  moveUnit as updateUnitPosition,
  markActionUsed,
  resetActionState,
  ActionState,
  EquippedAbilities,
} from '../models/Unit';
import { Position } from '../models/Position';
import {
  Ability,
  AbilityType,
  SampleAbilities,
  TargetType,
  Element,
  createWeaponAbility,
} from '../models/Ability';

// GameSystemのアクション結果型
export interface ActionResult {
  success: boolean;
  reason?: string;
  effects?: {
    type: string;
    sourceId?: string;
    targetId?: string;
    value?: number;
  }[];
}

export class GameSystem {
  private state: BattleState;
  private abilities: { [key: string]: Ability };

  constructor(mapWidth: number = 13, mapHeight: number = 13) {
    this.state = createBattleState(mapWidth, mapHeight);
    this.abilities = { ...SampleAbilities };
  }

  // 初期状態のセットアップ
  // 初期状態のセットアップ
  public setupInitialState(): void {
    // プレイヤーチーム（4ユニット）
    this.addUnitToTeam('騎士1', 'Knight', { x: 1, y: 1 }, 0, {
      weapon: 'mithril_sword',
      magic: [],
      support: 'counter',
      item: ['potion'],
    });

    this.addUnitToTeam('弓兵2', 'Archer', { x: 2, y: 1 }, 0, {
      weapon: 'short_bow',
      magic: [],
      support: 'concentrate',
      item: ['potion'],
    });

    this.addUnitToTeam('魔道士3', 'Mage', { x: 3, y: 1 }, 0, {
      weapon: 'rod',
      magic: ['fireball'],
      support: 'magic_power_up',
      item: ['potion'],
    });

    this.addUnitToTeam('僧侶4', 'Priest', { x: 4, y: 1 }, 0, {
      weapon: 'staff',
      magic: ['healing'],
      support: 'mp_recovery',
      item: ['potion'],
    });

    // 敵チーム（4ユニット）
    this.addUnitToTeam('敵騎士1', 'Knight', { x: 11, y: 11 }, 1, {
      weapon: 'mithril_sword',
      magic: [],
      support: 'counter',
      item: ['potion'],
    });

    this.addUnitToTeam('敵弓兵2', 'Archer', { x: 10, y: 11 }, 1, {
      weapon: 'short_bow',
      magic: [],
      support: 'concentrate',
      item: ['potion'],
    });

    this.addUnitToTeam('敵魔道士3', 'Mage', { x: 9, y: 11 }, 1, {
      weapon: 'rod',
      magic: ['fireball'],
      support: 'magic_power_up',
      item: ['potion'],
    });

    this.addUnitToTeam('敵僧侶4', 'Priest', { x: 8, y: 11 }, 1, {
      weapon: 'staff',
      magic: ['healing'],
      support: 'mp_recovery',
      item: ['potion'],
    });

    // マップに高低差を設定する例
    this.setTileHeight({ x: 6, y: 6 }, 2);
    this.setTileHeight({ x: 5, y: 5 }, 1);
    this.setTileHeight({ x: 7, y: 7 }, 1);

    // サンプルアビリティを登録
    this.registerAbility(SampleAbilities.MithrilSword);
    this.registerAbility(SampleAbilities.Fireball);
    this.registerAbility(SampleAbilities.Healing);
    this.registerAbility(SampleAbilities.Potion);

    // 追加のサンプルアビリティの登録
    // 弓兵用の武器
    this.registerAbility(
      createWeaponAbility(
        'short_bow',
        'ショートボウ',
        12,
        Element.NONE,
        3, // より長い射程
        '標準的な弓。遠距離から攻撃できる'
      )
    );

    // 魔道士と僧侶用の武器
    this.registerAbility(
      createWeaponAbility(
        'rod',
        'ロッド',
        8,
        Element.NONE,
        1,
        '魔力を集約する杖。魔法の威力を高める'
      )
    );

    this.registerAbility(
      createWeaponAbility(
        'staff',
        'スタッフ',
        6,
        Element.HOLY,
        1,
        '回復魔法を高める聖なる杖'
      )
    );

    // サポートアビリティ（仮設定）
    this.abilities['counter'] = {
      id: 'counter',
      name: 'カウンター',
      description: '物理攻撃を受けた時、反撃することがある',
      type: AbilityType.PASSIVE,
      targetType: TargetType.SELF,
      range: 0,
      power: 0,
      element: Element.NONE,
      castTime: 0,
      cooldown: 0,
      iconPath: '/assets/abilities/passive/counter.png',
      rarity: 'uncommon',
      canUse: () => false, // パッシブなので直接使用不可
      validateTarget: () => false,
      execute: (_user, _target, state) => state,
    };

    this.abilities['concentrate'] = {
      id: 'concentrate',
      name: '集中',
      description: '攻撃時、クリティカル率が上昇する',
      type: AbilityType.PASSIVE,
      targetType: TargetType.SELF,
      range: 0,
      power: 0,
      element: Element.NONE,
      castTime: 0,
      cooldown: 0,
      iconPath: '/assets/abilities/passive/concentrate.png',
      rarity: 'uncommon',
      canUse: () => false,
      validateTarget: () => false,
      execute: (_user, _target, state) => state,
    };

    this.abilities['magic_power_up'] = {
      id: 'magic_power_up',
      name: '魔力上昇',
      description: '魔法攻撃の威力が上昇する',
      type: AbilityType.PASSIVE,
      targetType: TargetType.SELF,
      range: 0,
      power: 0,
      element: Element.NONE,
      castTime: 0,
      cooldown: 0,
      iconPath: '/assets/abilities/passive/magic_power_up.png',
      rarity: 'uncommon',
      canUse: () => false,
      validateTarget: () => false,
      execute: (_user, _target, state) => state,
    };

    this.abilities['mp_recovery'] = {
      id: 'mp_recovery',
      name: 'MP回復',
      description: 'ターン終了時に少量のMPを回復する',
      type: AbilityType.PASSIVE,
      targetType: TargetType.SELF,
      range: 0,
      power: 0,
      element: Element.NONE,
      castTime: 0,
      cooldown: 0,
      iconPath: '/assets/abilities/passive/mp_recovery.png',
      rarity: 'uncommon',
      canUse: () => false,
      validateTarget: () => false,
      execute: (_user, _target, state) => state,
    };
  }

  // アビリティを登録
  public registerAbility(ability: Ability): void {
    this.abilities[ability.id] = ability;
  }

  // アビリティ取得
  public getAbility(abilityId: string): Ability | undefined {
    return this.abilities[abilityId];
  }

  // 全アビリティ取得
  public getAllAbilities(): { [key: string]: Ability } {
    return { ...this.abilities };
  }

  // ユニットをチームに追加
  private addUnitToTeam(
    name: string,
    job: JobType,
    position: Position,
    teamId: number,
    equippedAbilities?: Partial<EquippedAbilities>
  ): void {
    const unit = createUnit(
      name,
      job,
      position,
      teamId,
      'south',
      undefined,
      equippedAbilities
    );
    this.state = addUnit(this.state, unit);
  }

  // タイルの高さを設定
  public setTileHeight(position: Position, height: number): void {
    this.state.map.setTileHeight(position, height);
  }

  // タイルの通行可能性を設定
  public setTilePassable(position: Position, passable: boolean): void {
    this.state.map.setTilePassable(position, passable);
  }

  // CTを処理し、次のターンへ
  public processTick(): void {
    this.state = processCT(this.state);
  }

  // ユニットを移動
  public moveUnit(unitId: string, targetPosition: Position): boolean {
    // 対象ユニットを取得
    const unit = getUnitById(this.state, unitId);
    if (!unit) return false;

    // アクティブユニットかチェック
    if (this.state.activeUnitId !== unitId) {
      return false;
    }

    // すでにターン終了していないかチェック
    if (unit.actionState === ActionState.TURN_ENDED) {
      return false;
    }

    // 移動可能範囲内かチェック
    const movePositions = getUnitMoveRange(this.state, unitId);
    const isValidMove = movePositions.some(
      (pos) => pos.x === targetPosition.x && pos.y === targetPosition.y
    );

    if (!isValidMove) {
      return false;
    }

    // 移動を実行
    const updatedUnit = updateUnitPosition(unit, targetPosition);

    // 移動後の向きを設定（移動方向に基づく）
    let newDirection = unit.direction;

    // 水平方向の移動が垂直方向より大きい場合
    const dx = targetPosition.x - unit.position.x;
    const dy = targetPosition.y - unit.position.y;

    if (Math.abs(dx) >= Math.abs(dy)) {
      newDirection = dx > 0 ? 'east' : 'west';
    } else {
      newDirection = dy > 0 ? 'south' : 'north';
    }

    // 向きを更新
    const finalUnit = {
      ...updatedUnit,
      direction: newDirection,
    };

    // ゲーム状態を更新
    this.state = {
      ...this.state,
      units: this.state.units.map((u) => (u.id === unitId ? finalUnit : u)),
    };

    // 行動状態に応じたアクティブユニットの更新
    if (finalUnit.actionState === ActionState.TURN_ENDED) {
      this.state = {
        ...this.state,
        activeUnitId: null,
      };
    }

    return true;
  }

  // ユニットの移動可能範囲を取得
  public getUnitMoveRange(unitId: string): Position[] {
    return getUnitMoveRange(this.state, unitId);
  }

  // アクション実行のメイン関数
  public executeAbility(
    sourceUnitId: string,
    abilityId: string,
    targetUnitId?: string,
    targetPosition?: Position
  ): ActionResult {
    // ユニットとアビリティの取得
    const sourceUnit = getUnitById(this.state, sourceUnitId);
    const ability = this.getAbility(abilityId);

    // デバッグログを追加
    console.log('アビリティ実行開始:', {
      sourceUnit: sourceUnit?.id,
      ability: ability?.id,
      targetUnitId,
      targetPosition,
    });

    // 基本チェック
    if (!sourceUnit) {
      console.log('アビリティ実行失敗: ソースユニットが見つかりません');
      return { success: false, reason: 'source_unit_not_found' };
    }

    if (!ability) {
      console.log('アビリティ実行失敗: アビリティが見つかりません', abilityId);
      return { success: false, reason: 'ability_not_found' };
    }

    // ユニットがアクティブかチェック
    if (this.state.activeUnitId !== sourceUnitId) {
      console.log('アビリティ実行失敗: アクティブユニットではありません');
      return { success: false, reason: 'not_active_unit' };
    }

    // ターン終了状態でないかチェック
    if (sourceUnit.actionState === ActionState.TURN_ENDED) {
      console.log('アビリティ実行失敗: 既にターン終了しています');
      return { success: false, reason: 'turn_already_ended' };
    }

    // アビリティが使用可能かチェック
    if (!ability.canUse(sourceUnit, this.state)) {
      console.log('アビリティ実行失敗: アビリティが使用できません');
      return { success: false, reason: 'cannot_use_ability' };
    }

    // ターゲットの設定
    let target: Unit | Position | undefined;

    if (targetUnitId) {
      // ユニットを対象とする場合
      target = getUnitById(this.state, targetUnitId);
      console.log('ターゲットユニット:', target?.id);
      if (!target) {
        console.log('アビリティ実行失敗: ターゲットユニットが見つかりません');
        return { success: false, reason: 'target_unit_not_found' };
      }
    } else if (targetPosition) {
      // 位置を対象とする場合
      target = targetPosition;
      console.log('ターゲット位置:', target);
    } else {
      console.log('アビリティ実行失敗: ターゲットが指定されていません');
      return { success: false, reason: 'no_target_specified' };
    }

    // ターゲットの検証
    try {
      const isTargetValid = ability.validateTarget(
        sourceUnit,
        target,
        this.state
      );
      console.log('ターゲット検証結果:', isTargetValid);

      if (!isTargetValid) {
        console.log('アビリティ実行失敗: 無効なターゲットです');
        return { success: false, reason: 'invalid_target' };
      }
    } catch (error) {
      console.error('ターゲット検証エラー:', error);
      return { success: false, reason: 'target_validation_error' };
    }

    // アビリティの実行
    try {
      // 実行前の状態をコピー
      const prevState = { ...this.state };

      // アビリティを実行
      console.log('アビリティ実行処理開始');
      this.state = ability.execute(sourceUnit, target, this.state);
      console.log('アビリティ実行処理完了');

      // 行動済み状態に更新
      const updatedUnit = markActionUsed(
        this.state.units.find((u) => u.id === sourceUnitId) as Unit
      );

      this.state = {
        ...this.state,
        units: this.state.units.map((u) =>
          u.id === sourceUnitId ? updatedUnit : u
        ),
      };

      // 行動状態に応じたアクティブユニットの更新
      if (updatedUnit.actionState === ActionState.TURN_ENDED) {
        this.state = {
          ...this.state,
          activeUnitId: null,
        };
      }

      // 成功結果の返却
      console.log('アビリティ実行成功');
      return {
        success: true,
        effects: this.calculateEffects(prevState, this.state),
      };
    } catch (error) {
      console.error('アビリティ実行エラー:', error);
      return { success: false, reason: 'execution_error' };
    }
  }

  // 状態変化から効果を計算する関数
  private calculateEffects(
    prevState: BattleState,
    nextState: BattleState
  ): { type: string; sourceId?: string; targetId?: string; value?: number }[] {
    const effects: {
      type: string;
      sourceId?: string;
      targetId?: string;
      value?: number;
    }[] = [];

    // ユニットの状態変化をチェック
    nextState.units.forEach((nextUnit) => {
      const prevUnit = prevState.units.find((u) => u.id === nextUnit.id);
      if (!prevUnit) return;

      // HP変化チェック
      if (nextUnit.stats.hp !== prevUnit.stats.hp) {
        effects.push({
          type: nextUnit.stats.hp > prevUnit.stats.hp ? 'heal' : 'damage',
          targetId: nextUnit.id,
          value: Math.abs(nextUnit.stats.hp - prevUnit.stats.hp),
        });
      }

      // MP変化チェック
      if (nextUnit.stats.mp !== prevUnit.stats.mp) {
        effects.push({
          type: 'mp_change',
          targetId: nextUnit.id,
          value: nextUnit.stats.mp - prevUnit.stats.mp,
        });
      }

      // 他の効果もここに追加可能
    });

    return effects;
  }

  // ターン開始時のユニット状態リセット
  public resetUnitState(unitId: string): void {
    const unit = getUnitById(this.state, unitId);
    if (!unit) return;

    const updatedUnit = resetActionState(unit);

    this.state = {
      ...this.state,
      units: this.state.units.map((u) => (u.id === unitId ? updatedUnit : u)),
    };
  }

  // 現在の状態を取得
  public getState(): BattleState {
    return this.state;
  }

  // 旧executeAction - 互換性のために残す
  public executeAction(
    sourceUnitId: string,
    actionType: string,
    targetUnitId: string,
    targetPosition: Position
  ): ActionResult {
    // 旧アクションタイプを新システムに変換
    let abilityId: string;

    if (actionType.startsWith('attack')) {
      abilityId = 'mithril_sword';
    } else if (actionType.startsWith('heal')) {
      abilityId = 'healing';
    } else {
      return { success: false, reason: 'invalid_action_type' };
    }

    // 新しいexecuteAbilityを呼び出す
    return this.executeAbility(sourceUnitId, abilityId, targetUnitId);
  }

  // アクション使用済みマーク機能を追加
  public markActionUsed(unitId: string): ActionResult {
    // ユニット取得
    const unit = getUnitById(this.state, unitId);
    if (!unit) {
      return { success: false, reason: 'unit_not_found' };
    }

    // アクティブユニットチェック
    if (this.state.activeUnitId !== unitId) {
      return { success: false, reason: 'not_active_unit' };
    }

    // ターン終了状態でないかチェック
    if (unit.actionState === ActionState.TURN_ENDED) {
      return { success: false, reason: 'turn_already_ended' };
    }

    // アクション使用済み状態に更新
    const updatedUnit = markActionUsed(unit);

    // ゲーム状態を更新
    this.state = {
      ...this.state,
      units: this.state.units.map((u) => (u.id === unitId ? updatedUnit : u)),
    };

    // ターン終了の場合はアクティブユニットをクリア
    if (updatedUnit.actionState === ActionState.TURN_ENDED) {
      this.state = {
        ...this.state,
        activeUnitId: null,
      };
    }

    return { success: true };
  }
}
