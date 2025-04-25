import {
  BattleState,
  createBattleState,
  addUnit,
  processCT,
  moveUnitAction,
  getUnitMoveRange,
} from '../models/BattleState';
import { createUnit, JobType } from '../models/Unit';
import { Position } from '../models/Position';

export class GameSystem {
  private state: BattleState;

  constructor(mapWidth: number = 13, mapHeight: number = 13) {
    this.state = createBattleState(mapWidth, mapHeight);
  }

  // 初期状態のセットアップ
  public setupInitialState(): void {
    // プレイヤーチーム（4ユニット）
    this.addUnitToTeam('Knight 1', 'Knight', { x: 1, y: 1 }, 0);
    this.addUnitToTeam('Archer 1', 'Archer', { x: 2, y: 1 }, 0);
    this.addUnitToTeam('Mage 1', 'Mage', { x: 3, y: 1 }, 0);
    this.addUnitToTeam('Priest 1', 'Priest', { x: 4, y: 1 }, 0);

    // 敵チーム（4ユニット）
    this.addUnitToTeam('Enemy Knight', 'Knight', { x: 11, y: 11 }, 1);
    this.addUnitToTeam('Enemy Archer', 'Archer', { x: 10, y: 11 }, 1);
    this.addUnitToTeam('Enemy Mage', 'Mage', { x: 9, y: 11 }, 1);
    this.addUnitToTeam('Enemy Priest', 'Priest', { x: 8, y: 11 }, 1);

    // マップに高低差を設定する例
    this.setTileHeight({ x: 6, y: 6 }, 2);
    this.setTileHeight({ x: 5, y: 5 }, 1);
    this.setTileHeight({ x: 7, y: 7 }, 1);
  }

  // ユニットをチームに追加
  private addUnitToTeam(
    name: string,
    job: JobType,
    position: Position,
    teamId: number
  ): void {
    const unit = createUnit(name, job, position, teamId);
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
    // ユニットが行動可能かチェック
    if (this.state.activeUnitId !== unitId) {
      return false;
    }

    const previousState = this.state;
    this.state = moveUnitAction(this.state, unitId, targetPosition);

    // 状態が変わったかどうかで成功したかを判断
    return previousState !== this.state;
  }

  // ユニットの移動可能範囲を取得
  public getUnitMoveRange(unitId: string): Position[] {
    return getUnitMoveRange(this.state, unitId);
  }

  // 現在の状態を取得
  public getState(): BattleState {
    return this.state;
  }

  // アクション処理関数
  public executeAction(
    sourceUnitId: string,
    actionType: string,
    targetUnitId: string,
    targetPosition: Position
  ): { success: boolean; reason?: string } {
    // 戻り値の型を変更
    // アクティブユニットかどうか確認
    if (this.state.activeUnitId !== sourceUnitId) {
      console.log('アクティブユニットではありません');
      return { success: false, reason: 'active_unit_check_failed' };
    }

    // ソースと対象のユニットを取得
    const sourceUnit = this.state.units.find(
      (unit) => unit.id === sourceUnitId
    );
    const targetUnit = this.state.units.find(
      (unit) => unit.id === targetUnitId
    );

    if (!sourceUnit || !targetUnit) {
      console.log('ユニットが見つかりません');
      return { success: false, reason: 'unit_not_found' };
    }

    // 距離チェック
    const distance =
      Math.abs(sourceUnit.position.x - targetPosition.x) +
      Math.abs(sourceUnit.position.y - targetPosition.y);

    let actionRange = 0;

    if (actionType.startsWith('attack')) {
      actionRange = 1; // 攻撃範囲
    } else if (actionType.startsWith('heal')) {
      actionRange = 2; // 回復範囲
    }

    if (distance > actionRange) {
      console.log('対象が範囲外です');
      return { success: false, reason: 'target_out_of_range' };
    }

    // アクション実行
    if (actionType.startsWith('attack')) {
      // 攻撃処理
      const attackPower = sourceUnit.stats.atk;
      const defense = targetUnit.stats.def;
      const damage = Math.max(1, attackPower - defense / 2);

      // ダメージ適用
      const updatedUnits = this.state.units.map((unit) => {
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

      // ターン終了処理
      this.state = {
        ...this.state,
        units: updatedUnits.map((unit) =>
          unit.id === sourceUnitId
            ? { ...unit, stats: { ...unit.stats, ct: 0 } }
            : unit
        ),
        activeUnitId: null,
        turnCount: this.state.turnCount + 1,
      };

      return { success: true };
    } else if (actionType.startsWith('heal')) {
      // 回復処理
      const healAmount = 20;

      // HP回復
      const updatedUnits = this.state.units.map((unit) => {
        if (unit.id === targetUnit.id) {
          const newHp = Math.min(unit.stats.maxHp, unit.stats.hp + healAmount);
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

      // ターン終了処理
      this.state = {
        ...this.state,
        units: updatedUnits.map((unit) =>
          unit.id === sourceUnitId
            ? { ...unit, stats: { ...unit.stats, ct: 0 } }
            : unit
        ),
        activeUnitId: null,
        turnCount: this.state.turnCount + 1,
      };

      return { success: true };
    }

    return { success: false, reason: 'invalid_action_type' };
  }
}
