import { Position, positionEquals } from './Position';
import { Tile, createTile } from './Tile';

export class TileMap {
  private tiles: Tile[] = [];
  private width: number;
  private height: number;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.initializeEmptyMap();
  }

  // 空のマップを初期化
  private initializeEmptyMap(): void {
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < this.width; x++) {
        this.tiles.push(createTile({ x, y }));
      }
    }
  }

  // 指定された位置にタイルがあるかチェック
  public isValidPosition(position: Position): boolean {
    return (
      position.x >= 0 &&
      position.x < this.width &&
      position.y >= 0 &&
      position.y < this.height
    );
  }

  // 指定された位置のタイルを取得
  public getTile(position: Position): Tile | undefined {
    if (!this.isValidPosition(position)) {
      return undefined;
    }
    return this.tiles.find((tile) => positionEquals(tile.position, position));
  }

  // 指定された位置のタイルの高さを設定
  public setTileHeight(position: Position, height: number): void {
    const tile = this.getTile(position);
    if (tile) {
      tile.height = height;
    }
  }

  // 指定された位置のタイルの通行可能性を設定
  public setTilePassable(position: Position, passable: boolean): void {
    const tile = this.getTile(position);
    if (tile) {
      tile.passable = passable;
    }
  }

  // 全てのタイルを取得
  public getAllTiles(): Tile[] {
    return [...this.tiles];
  }

  // マップの幅を取得
  public getWidth(): number {
    return this.width;
  }

  // マップの高さを取得
  public getHeight(): number {
    return this.height;
  }
}
