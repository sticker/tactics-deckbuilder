// src/utils/constants.ts

// タイルのサイズ定義
export const TILE_WIDTH = 64;
export const TILE_HEIGHT = 32;
export const TILE_HEIGHT_OFFSET = 16; // 高さ1単位あたりのオフセット

// アニメーション関連の定数
export const CAMERA_PAN_DURATION = 800; // カメラパンのアニメーション時間（ミリ秒）
export const UNIT_MOVE_BASE_DURATION = 800; // 基本移動アニメーション時間（ミリ秒）
export const UNIT_MOVE_STEP_DURATION = 150; // 1マスの移動にかかる時間（ミリ秒）

// UI関連の定数
export const UNIT_HIT_RADIUS = TILE_WIDTH / 3; // ユニットのクリック判定サイズ

// 色の定数
export const COLORS = {
  // チームカラー
  TEAM_BLUE: 0x4444ff,
  TEAM_RED: 0xff4444,

  // 強調表示カラー
  SELECTED: 0xffff00,
  ACTIVE: 0x00ffff,
  DEFAULT_BORDER: 0x000000,

  // 移動範囲
  MOVE_RANGE_ACTIVE: 0x00ff00,
  MOVE_RANGE_INACTIVE: 0xff9900,

  // アクション範囲
  ATTACK_RANGE: 0xff0000,
  HEAL_RANGE: 0x00ff00,

  // タイル色
  TILE_PASSABLE: 0x88aaff,
  TILE_IMPASSABLE: 0x884444,
  TILE_SIDE: 0x555577,
  TILE_BORDER: 0x333355,
};

// アクションタイプ
export enum ActionType {
  MOVE = 'move',
  ATTACK = 'attack',
  HEAL = 'heal',
}

// ゲームイベント
export enum GameEvent {
  UNIT_SELECTED = 'unit_selected',
  UNIT_MOVED = 'unit_moved',
  ACTION_EXECUTED = 'action_executed',
  TURN_CHANGED = 'turn_changed',
}
