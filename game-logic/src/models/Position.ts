// ゲーム内の位置を表す型
export interface Position {
  x: number;
  y: number;
}

// ポジションを作成するヘルパー関数
export function createPosition(x: number, y: number): Position {
  return { x, y };
}

// 二つのポジションが等しいかチェックする
export function positionEquals(a: Position, b: Position): boolean {
  return a.x === b.x && a.y === b.y;
}

// 二つのポジション間の距離（マンハッタン距離）を計算
export function getDistance(a: Position, b: Position): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

// 指定された位置から移動可能な隣接タイルを取得
export function getAdjacentPositions(position: Position): Position[] {
  const { x, y } = position;
  return [
    { x, y: y - 1 }, // 上
    { x: x + 1, y }, // 右
    { x, y: y + 1 }, // 下
    { x: x - 1, y }, // 左
  ];
}
