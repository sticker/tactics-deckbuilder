import { Position } from './Position';

export interface Tile {
  position: Position;
  height: number; // 高低差
  passable: boolean; // 通行可能かどうか
}

export function createTile(position: Position, height: number = 0, passable: boolean = true): Tile {
  return {
    position,
    height,
    passable,
  };
}