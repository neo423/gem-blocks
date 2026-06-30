import type { Cell } from "./types";

export type BoardInputMetrics = {
  boardX: number;
  boardY: number;
  gemSize: number;
  gap: number;
  boardSize: number;
};

export function pointerToBoardCell(
  x: number,
  y: number,
  metrics: BoardInputMetrics,
  forgiveness = 0
): Cell | null {
  const step = metrics.gemSize + metrics.gap;
  const localX = x - metrics.boardX;
  const localY = y - metrics.boardY;
  const halfHit = metrics.gemSize / 2 + forgiveness;
  const col = Math.round((localX - metrics.gemSize / 2) / step);
  const row = Math.round((localY - metrics.gemSize / 2) / step);

  if (row < 0 || row >= metrics.boardSize || col < 0 || col >= metrics.boardSize) {
    return null;
  }

  const centerX = col * step + metrics.gemSize / 2;
  const centerY = row * step + metrics.gemSize / 2;

  if (Math.abs(localX - centerX) > halfHit || Math.abs(localY - centerY) > halfHit) {
    return null;
  }

  return { row, col };
}
