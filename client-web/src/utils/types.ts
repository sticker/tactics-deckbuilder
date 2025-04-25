// src/utils/types.ts
import * as PIXI from 'pixi.js';
import { Position, Unit, BattleState } from 'game-logic';

/**
 * 移動アニメーション用の型定義
 */
export interface AnimatingUnit {
  unitId: string;
  path: Position[];
  currentStep: number;
  totalSteps: number;
  startTime: number;
  duration: number; // 移動全体の所要時間（ミリ秒）
  stepDuration: number; // 1ステップあたりの所要時間（ミリ秒）
  onComplete: () => void;
}

/**
 * コンテナ参照のための型定義
 */
export interface ContainersRef {
  mapContainer: React.RefObject<PIXI.Container | null>;
  unitContainer: React.RefObject<PIXI.Container | null>;
  overlayContainer: React.RefObject<PIXI.Container | null>;
}

/**
 * タイル情報の型定義
 */
export interface TileInfo {
  position: Position;
  height: number;
}

/**
 * レンダラーの設定オプション
 */
export interface RendererOptions {
  showDebugInfo?: boolean;
  disableAnimations?: boolean;
  highlightActiveUnit?: boolean;
  showGrid?: boolean;
}

// ユーティリティタイプ

/**
 * マップの位置をキーとする型
 */
export type MapPositionKey = `${number},${number}`;

/**
 * マップ位置からの値のマッピング
 */
export type PositionMap<T> = Map<MapPositionKey, T>;

/**
 * ユニット情報の型（既存のUnitタイプを拡張）
 */
export interface ExtendedUnitInfo extends Unit {
  isSelected: boolean;
  isActive: boolean;
  lastPosition: Position;
  animationProgress: number;
}

/**
 * イベントハンドラのプロパティ
 */
export interface EventHandlerProps {
  gameSystemRef: React.RefObject<BattleState | null>;
  overlayContainerRef: React.RefObject<PIXI.Container | null>;
  selectedUnitId: string | null;
  setSelectedUnitId: (id: string | null) => void;
  currentActionType: string | null;
}
