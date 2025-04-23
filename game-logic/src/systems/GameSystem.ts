import { BattleState, createBattleState, addUnit, processCT, moveUnitAction, getUnitMoveRange } from '../models/BattleState';
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
  private addUnitToTeam(name: string, job: JobType, position: Position, teamId: number): void {
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
}
