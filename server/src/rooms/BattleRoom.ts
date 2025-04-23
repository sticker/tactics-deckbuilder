import { Room, Client } from 'colyseus';
import { Schema, type, MapSchema } from '@colyseus/schema';
import { GameSystem, Position } from 'game-logic';

// スキーマ定義（同期するデータ構造）
class UnitState extends Schema {
  @type('string') id: string = '';
  @type('string') name: string = '';
  @type('string') job: string = '';
  @type('number') x: number = 0;
  @type('number') y: number = 0;
  @type('number') teamId: number = 0;
  @type('number') hp: number = 0;
  @type('number') maxHp: number = 0;
  @type('number') atk: number = 0;
  @type('number') def: number = 0;
  @type('number') spd: number = 0;
  @type('number') ct: number = 0;
}

class BattleState extends Schema {
  @type({ map: UnitState }) units = new MapSchema<UnitState>();
  @type('string') activeUnitId: string | null = null;
  @type('number') turnCount: number = 0;
  @type('number') tickCount: number = 0;
}

export class BattleRoom extends Room<BattleState> {
  private gameSystem: GameSystem;
  private tickInterval: NodeJS.Timeout | null = null;

  constructor() {
    super();
    this.gameSystem = new GameSystem(13, 13);
    
    // シート予約のタイムアウトを延長（デフォルトは10秒）
    this.seatReservationTime = 60;
  }

  onCreate() {
    this.setState(new BattleState());
    this.gameSystem.setupInitialState();
    
    // 初期状態をスキーマに同期
    this.syncGameState();

    // メッセージハンドラの登録
    this.onMessage('move', (client, message: { unitId: string; x: number; y: number }) => {
      this.handleMoveUnit(client, message);
    });

    // 100ms間隔でゲームティックを処理
    this.tickInterval = setInterval(() => {
      this.processTick();
    }, 100);

    console.log('バトルルームが作成されました');
  }

  onJoin(client: Client) {
    console.log(`クライアント ${client.sessionId} が参加しました`);
    
    // プレイヤーにチームを割り当て（簡易版：最初のプレイヤーがチーム0、2番目がチーム1）
    const teamId = this.clients.length === 1 ? 0 : 1;
    client.send('assign-team', { teamId });
  }

  onLeave(client: Client) {
    console.log(`クライアント ${client.sessionId} が退出しました`);
  }

  onDispose() {
    if (this.tickInterval) {
      clearInterval(this.tickInterval);
    }
    console.log('バトルルームが破棄されました');
  }

  // ゲームティックの処理
  private processTick() {
    this.gameSystem.processTick();
    this.syncGameState();
  }

  // ユニット移動の処理
  private handleMoveUnit(_: Client, message: { unitId: string; x: number; y: number }) {
    const { unitId, x, y } = message;
    const targetPosition: Position = { x, y };
    
    // ゲームシステムで移動を実行
    const success = this.gameSystem.moveUnit(unitId, targetPosition);
    
    if (success) {
      // 状態を同期
      this.syncGameState();
    }
  }

  // ゲーム状態をColyseusスキーマに同期
  private syncGameState() {
    const gameState = this.gameSystem.getState();
    
    // ユニット情報の同期
    const currentUnits = new Set(gameState.units.map(unit => unit.id));
    
    // 不要なユニットを削除
    this.state.units.forEach((_, id) => {
      if (!currentUnits.has(id)) {
        this.state.units.delete(id);
      }
    });
    
    // ユニット情報を更新
    gameState.units.forEach(unit => {
      let unitState = this.state.units.get(unit.id);
      
      if (!unitState) {
        unitState = new UnitState();
        this.state.units.set(unit.id, unitState);
      }
      
      // プロパティの更新
      unitState.id = unit.id;
      unitState.name = unit.name;
      unitState.job = unit.job;
      unitState.x = unit.position.x;
      unitState.y = unit.position.y;
      unitState.teamId = unit.teamId;
      unitState.hp = unit.stats.hp;
      unitState.maxHp = unit.stats.maxHp;
      unitState.atk = unit.stats.atk;
      unitState.def = unit.stats.def;
      unitState.spd = unit.stats.spd;
      unitState.ct = unit.stats.ct;
    });
    
    // ゲーム状態の同期
    this.state.activeUnitId = gameState.activeUnitId;
    this.state.turnCount = gameState.turnCount;
    this.state.tickCount = gameState.tickCount;
  }
}