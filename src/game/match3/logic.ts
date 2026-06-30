import {
  BOARD_COLS,
  BOARD_ROWS,
  EMPTY_GEM,
  GEM_COLORS,
  SKIN_TIERS,
  SPECIAL_BOMB,
  SPECIAL_LINE,
  SPECIAL_NONE
} from "./balance";
import type { Board, Cell, GemValue, MatchPlan, MatchRun, SkinTier, SpecialBoard, SpecialValue } from "./types";

type RandomFn = () => number;

export type GravityMove = {
  from: Cell;
  to: Cell;
};

export type GravitySpawn = {
  cell: Cell;
  value: GemValue;
};

export type GravityPlan = {
  moves: GravityMove[];
  spawns: GravitySpawn[];
};

export function cellKey(cell: Cell) {
  return cell.row * BOARD_COLS + cell.col;
}

export function cellFromKey(key: number): Cell {
  return { row: Math.floor(key / BOARD_COLS), col: key % BOARD_COLS };
}

export function cloneBoard(board: Board): Board {
  return board.map((row) => [...row]);
}

export function createEmptySpecialBoard(): SpecialBoard {
  return Array.from({ length: BOARD_ROWS }, () =>
    Array.from({ length: BOARD_COLS }, () => SPECIAL_NONE as SpecialValue)
  );
}

export function skinTierForLevel(level: number): SkinTier {
  const safeLevel = Math.max(1, Math.floor(level));
  return [...SKIN_TIERS].reverse().find((tier) => safeLevel >= tier.minLevel) ?? SKIN_TIERS[0];
}

export function findRuns(board: Board): MatchRun[] {
  const runs: MatchRun[] = [];

  for (let row = 0; row < BOARD_ROWS; row += 1) {
    let col = 0;
    while (col < BOARD_COLS) {
      const value = board[row][col];
      if (value === EMPTY_GEM) {
        col += 1;
        continue;
      }

      const start = col;
      while (col < BOARD_COLS && board[row][col] === value) {
        col += 1;
      }

      const length = col - start;
      if (length >= 3) {
        runs.push({
          direction: "horizontal",
          length,
          cells: Array.from({ length }, (_, index) => ({ row, col: start + index }))
        });
      }
    }
  }

  for (let col = 0; col < BOARD_COLS; col += 1) {
    let row = 0;
    while (row < BOARD_ROWS) {
      const value = board[row][col];
      if (value === EMPTY_GEM) {
        row += 1;
        continue;
      }

      const start = row;
      while (row < BOARD_ROWS && board[row][col] === value) {
        row += 1;
      }

      const length = row - start;
      if (length >= 3) {
        runs.push({
          direction: "vertical",
          length,
          cells: Array.from({ length }, (_, index) => ({ row: start + index, col }))
        });
      }
    }
  }

  return runs;
}

export function anyMatch(board: Board) {
  return findRuns(board).length > 0;
}

export function areAdjacent(a: Cell, b: Cell) {
  return Math.abs(a.row - b.row) + Math.abs(a.col - b.col) === 1;
}

export function isInside(cell: Cell) {
  return cell.row >= 0 && cell.row < BOARD_ROWS && cell.col >= 0 && cell.col < BOARD_COLS;
}

export function swapCells<T>(board: T[][], a: Cell, b: Cell) {
  const value = board[a.row][a.col];
  board[a.row][a.col] = board[b.row][b.col];
  board[b.row][b.col] = value;
}

export function swapWouldMatch(board: Board, a: Cell, b: Cell) {
  if (!isInside(a) || !isInside(b) || !areAdjacent(a, b)) {
    return false;
  }

  const copy = cloneBoard(board);
  swapCells(copy, a, b);
  return anyMatch(copy);
}

export function findHint(board: Board): [Cell, Cell] | null {
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      const here = { row, col };
      const right = { row, col: col + 1 };
      const down = { row: row + 1, col };
      if (isInside(right) && swapWouldMatch(board, here, right)) {
        return [here, right];
      }
      if (isInside(down) && swapWouldMatch(board, here, down)) {
        return [here, down];
      }
    }
  }
  return null;
}

export function planMatches(runs: MatchRun[], swapCellsForCreation: Cell[] = []): MatchPlan {
  const matched = new Set<number>();
  const creations: MatchPlan["creations"] = [];
  const creationKeys = new Set<number>();

  runs.forEach((run) => {
    run.cells.forEach((cell) => matched.add(cellKey(cell)));
    if (run.length < 4) {
      return;
    }

    const swappedCell = run.cells.find((cell) =>
      swapCellsForCreation.some((candidate) => candidate.row === cell.row && candidate.col === cell.col)
    );
    const creationCell = swappedCell ?? run.cells[Math.floor(run.length / 2)];
    const key = cellKey(creationCell);
    if (creationKeys.has(key)) {
      return;
    }

    creationKeys.add(key);
    creations.push({
      ...creationCell,
      special: run.length >= 5 ? SPECIAL_LINE : SPECIAL_BOMB
    });
  });

  return { matched, creations, creationKeys };
}

export function expandRemoval(matched: Set<number>, creationKeys: Set<number>, specials: SpecialBoard) {
  const remove = new Set<number>();
  const queue: number[] = [];

  matched.forEach((key) => {
    if (creationKeys.has(key)) {
      return;
    }
    remove.add(key);
    const { row, col } = cellFromKey(key);
    if (specials[row][col] !== SPECIAL_NONE) {
      queue.push(key);
    }
  });

  const triggered = new Set<number>();
  while (queue.length > 0) {
    const key = queue.shift()!;
    if (triggered.has(key)) {
      continue;
    }
    triggered.add(key);
    const { row, col } = cellFromKey(key);
    const special = specials[row][col];
    const affected: number[] = [];

    if (special === SPECIAL_BOMB) {
      for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
        for (let colOffset = -1; colOffset <= 1; colOffset += 1) {
          const cell = { row: row + rowOffset, col: col + colOffset };
          if (isInside(cell)) {
            affected.push(cellKey(cell));
          }
        }
      }
    }

    if (special === SPECIAL_LINE) {
      for (let lineCol = 0; lineCol < BOARD_COLS; lineCol += 1) {
        affected.push(cellKey({ row, col: lineCol }));
      }
      for (let lineRow = 0; lineRow < BOARD_ROWS; lineRow += 1) {
        affected.push(cellKey({ row: lineRow, col }));
      }
    }

    affected.forEach((affectedKey) => {
      if (creationKeys.has(affectedKey)) {
        return;
      }
      remove.add(affectedKey);
      const cell = cellFromKey(affectedKey);
      if (specials[cell.row][cell.col] !== SPECIAL_NONE && !triggered.has(affectedKey)) {
        queue.push(affectedKey);
      }
    });
  }

  return remove;
}

export function applyGravity(board: Board, specials: SpecialBoard, spawn: () => GemValue) {
  applyGravityWithPlan(board, specials, spawn);
}

export function applyGravityWithPlan(board: Board, specials: SpecialBoard, spawn: () => GemValue): GravityPlan {
  const plan: GravityPlan = { moves: [], spawns: [] };

  for (let col = 0; col < BOARD_COLS; col += 1) {
    let writeRow = BOARD_ROWS - 1;
    for (let row = BOARD_ROWS - 1; row >= 0; row -= 1) {
      if (board[row][col] === EMPTY_GEM) {
        continue;
      }
      board[writeRow][col] = board[row][col];
      specials[writeRow][col] = specials[row][col];
      if (writeRow !== row) {
        plan.moves.push({ from: { row, col }, to: { row: writeRow, col } });
        board[row][col] = EMPTY_GEM;
        specials[row][col] = SPECIAL_NONE;
      }
      writeRow -= 1;
    }

    for (let row = writeRow; row >= 0; row -= 1) {
      const value = spawn();
      board[row][col] = value;
      specials[row][col] = SPECIAL_NONE;
      plan.spawns.push({ cell: { row, col }, value });
    }
  }

  return plan;
}

export function makeBoard(random: RandomFn = Math.random): Board {
  let seed = Math.floor(random() * 0x7fffffff) || 0x6d2b79f5;

  for (let attempt = 0; attempt < 240; attempt += 1) {
    const next = seededRandom(seed + attempt * 1013904223);
    const board = Array.from({ length: BOARD_ROWS }, () => Array.from({ length: BOARD_COLS }, () => EMPTY_GEM as GemValue));

    for (let row = 0; row < BOARD_ROWS; row += 1) {
      for (let col = 0; col < BOARD_COLS; col += 1) {
        board[row][col] = pickGemWithoutImmediateRun(board, row, col, next);
      }
    }

    if (!anyMatch(board) && findHint(board)) {
      return board;
    }
  }

  return forcedMoveBoard();
}

export function shuffleBoard(board: Board, specials: SpecialBoard, random: RandomFn = Math.random) {
  const pieces: Array<{ gem: GemValue; special: SpecialValue }> = [];
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      pieces.push({ gem: board[row][col], special: specials[row][col] });
    }
  }

  let seed = Math.floor(random() * 0x7fffffff) || 0x3c6ef372;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const next = seededRandom(seed + attempt * 1664525);
    const shuffled = [...pieces];
    for (let index = shuffled.length - 1; index > 0; index -= 1) {
      const target = Math.floor(next() * (index + 1));
      const value = shuffled[index];
      shuffled[index] = shuffled[target];
      shuffled[target] = value;
    }

    writePieces(board, specials, shuffled);
    if (!anyMatch(board) && findHint(board)) {
      return;
    }
  }

  const replacement = makeBoard(random);
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      board[row][col] = replacement[row][col];
      specials[row][col] = SPECIAL_NONE;
    }
  }
}

function pickGemWithoutImmediateRun(board: Board, row: number, col: number, random: RandomFn): GemValue {
  const candidates = Array.from({ length: GEM_COLORS }, (_, index) => index as GemValue);
  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    const value = candidates[index];
    candidates[index] = candidates[target];
    candidates[target] = value;
  }

  return (
    candidates.find((candidate) => {
      const horizontalRun = col >= 2 && board[row][col - 1] === candidate && board[row][col - 2] === candidate;
      const verticalRun = row >= 2 && board[row - 1][col] === candidate && board[row - 2][col] === candidate;
      return !horizontalRun && !verticalRun;
    }) ?? candidates[0]
  );
}

function seededRandom(initialSeed: number): RandomFn {
  let seed = initialSeed >>> 0;
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
}

function forcedMoveBoard(): Board {
  const board: Board = [
    [0, 1, 0, 2, 3, 4, 5, 0],
    [1, 0, 2, 3, 4, 5, 0, 1],
    [2, 0, 3, 4, 5, 0, 1, 2],
    [3, 4, 5, 0, 1, 2, 3, 4],
    [4, 5, 0, 1, 2, 3, 4, 5],
    [5, 1, 2, 3, 4, 5, 0, 1],
    [1, 2, 3, 4, 5, 0, 1, 2],
    [2, 3, 4, 5, 0, 1, 2, 3],
    [3, 4, 5, 0, 1, 2, 3, 4],
    [4, 5, 0, 1, 2, 3, 4, 5]
  ];

  if (anyMatch(board) || !findHint(board)) {
    throw new Error("Forced move fallback board is invalid");
  }

  return board;
}

function writePieces(board: Board, specials: SpecialBoard, pieces: Array<{ gem: GemValue; special: SpecialValue }>) {
  let index = 0;
  for (let row = 0; row < BOARD_ROWS; row += 1) {
    for (let col = 0; col < BOARD_COLS; col += 1) {
      board[row][col] = pieces[index].gem;
      specials[row][col] = pieces[index].special;
      index += 1;
    }
  }
}
