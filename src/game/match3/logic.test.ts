import { describe, expect, test } from "vitest";
import {
  applyGravity,
  applyGravityWithPlan,
  cellKey,
  createEmptySpecialBoard,
  expandRemoval,
  findHint,
  findRuns,
  makeBoard,
  planMatches,
  skinTierForLevel,
  swapWouldMatch,
  ultimateSwapRemoval
} from "./logic";
import {
  BOARD_COLS,
  BOARD_ROWS,
  EMPTY_GEM,
  SPECIAL_COLUMN,
  SPECIAL_NONE,
  SPECIAL_ROW,
  SPECIAL_ULTIMATE
} from "./balance";
import type { Board } from "./types";

describe("match-3 logic", () => {
  test("finds horizontal and vertical runs of three or more gems", () => {
    const board: Board = [
      [0, 0, 0, 1, 2, 3, 4, 5],
      [1, 2, 3, 4, 5, 0, 1, 2],
      [2, 3, 4, 5, 0, 1, 2, 3],
      [3, 4, 5, 0, 1, 2, 3, 4],
      [4, 5, 0, 1, 2, 3, 4, 5],
      [4, 0, 1, 2, 3, 4, 5, 0],
      [4, 1, 2, 3, 4, 5, 0, 1],
      [2, 2, 3, 4, 5, 0, 1, 2],
      [1, 3, 4, 5, 0, 1, 2, 3],
      [2, 4, 5, 0, 1, 2, 3, 4]
    ];

    const runs = findRuns(board);

    expect(runs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ direction: "horizontal", length: 3 }),
        expect.objectContaining({ direction: "vertical", length: 3 })
      ])
    );
  });

  test("creates directional gems from four-runs and an ultimate gem from five-runs", () => {
    const horizontalPlan = planMatches([
      {
        direction: "horizontal",
        length: 4,
        cells: [
          { row: 0, col: 0 },
          { row: 0, col: 1 },
          { row: 0, col: 2 },
          { row: 0, col: 3 }
        ]
      }
    ]);
    const verticalPlan = planMatches([
      {
        direction: "vertical",
        length: 4,
        cells: [
          { row: 0, col: 1 },
          { row: 1, col: 1 },
          { row: 2, col: 1 },
          { row: 3, col: 1 }
        ]
      }
    ]);
    const ultimatePlan = planMatches([
      {
        direction: "vertical",
        length: 5,
        cells: [
          { row: 0, col: 4 },
          { row: 1, col: 4 },
          { row: 2, col: 4 },
          { row: 3, col: 4 },
          { row: 4, col: 4 }
        ]
      }
    ]);

    expect(horizontalPlan.creations).toEqual([{ row: 0, col: 2, special: SPECIAL_ROW }]);
    expect(verticalPlan.creations).toEqual([{ row: 2, col: 1, special: SPECIAL_COLUMN }]);
    expect(ultimatePlan.creations).toEqual([{ row: 2, col: 4, special: SPECIAL_ULTIMATE }]);
  });

  test("expands directional special removals and chains through another special", () => {
    const specials = createEmptySpecialBoard();
    specials[2][2] = SPECIAL_ROW;
    specials[2][5] = SPECIAL_COLUMN;

    const removal = expandRemoval(new Set([cellKey({ row: 2, col: 2 })]), new Set(), specials);

    expect(removal.size).toBe(BOARD_COLS + BOARD_ROWS - 1);
    expect(removal).toContain(cellKey({ row: 2, col: 0 }));
    expect(removal).toContain(cellKey({ row: 9, col: 5 }));
  });

  test("ultimate swaps clear every gem matching the target color", () => {
    const board: Board = [
      [6, 1, 2, 3, 4, 5, 0, 1],
      [1, 2, 3, 4, 5, 0, 1, 2],
      [2, 3, 4, 5, 0, 1, 2, 3],
      [3, 4, 5, 0, 1, 2, 3, 4],
      [4, 5, 0, 1, 2, 3, 4, 5],
      [5, 0, 1, 2, 3, 4, 5, 0],
      [0, 1, 2, 3, 4, 5, 0, 1],
      [1, 2, 3, 4, 5, 0, 1, 2],
      [2, 3, 4, 5, 0, 1, 2, 3],
      [3, 4, 5, 0, 1, 2, 3, 4]
    ];
    const specials = createEmptySpecialBoard();
    specials[0][0] = SPECIAL_ULTIMATE;

    const removal = ultimateSwapRemoval(board, specials, { row: 0, col: 0 }, { row: 0, col: 1 });
    const yellowCount = board.flat().filter((value) => value === 1).length;

    expect(removal?.size).toBe(yellowCount + 1);
    expect(removal).toContain(cellKey({ row: 0, col: 0 }));
    expect(removal).toContain(cellKey({ row: 6, col: 1 }));
    expect(removal).not.toContain(cellKey({ row: 0, col: 2 }));
  });

  test("swapping two ultimate gems clears the entire board", () => {
    const board = makeBoard(() => 0.42);
    const specials = createEmptySpecialBoard();
    specials[0][0] = SPECIAL_ULTIMATE;
    specials[0][1] = SPECIAL_ULTIMATE;

    const removal = ultimateSwapRemoval(board, specials, { row: 0, col: 0 }, { row: 0, col: 1 });

    expect(removal?.size).toBe(BOARD_ROWS * BOARD_COLS);
  });

  test("applies gravity and refills empty cells from the top", () => {
    const board: Board = [
      [-1, 1, 2, 3, 4, 5, 0, 1],
      [0, 2, 3, 4, 5, 0, 1, 2],
      [-1, 3, 4, 5, 0, 1, 2, 3],
      [2, 4, 5, 0, 1, 2, 3, 4],
      [3, 5, 0, 1, 2, 3, 4, 5],
      [4, 0, 1, 2, 3, 4, 5, 0],
      [5, 1, 2, 3, 4, 5, 0, 1],
      [1, 2, 3, 4, 5, 0, 1, 2],
      [2, 3, 4, 5, 0, 1, 2, 3],
      [3, 4, 5, 0, 1, 2, 3, 4]
    ];
    const specials = createEmptySpecialBoard();

    applyGravity(board, specials, () => 4);

    expect(board[0][0]).toBe(4);
    expect(board[1][0]).toBe(4);
    expect(board[2][0]).toBe(0);
    expect(board[9][0]).toBe(3);
  });

  test("plans gravity moves and spawns only in columns with empty cells", () => {
    const board = makeBoard(() => 0.42);
    const specials = createEmptySpecialBoard();
    board[8][0] = EMPTY_GEM;
    specials[7][0] = SPECIAL_ROW;

    const plan = applyGravityWithPlan(board, specials, () => 4);

    expect(plan.spawns).toEqual([{ cell: { row: 0, col: 0 }, value: 4 }]);
    expect(plan.moves.every((move) => move.from.col === 0 && move.to.col === 0)).toBe(true);
    expect(plan.moves).toContainEqual({ from: { row: 7, col: 0 }, to: { row: 8, col: 0 } });
    expect(specials[8][0]).toBe(SPECIAL_ROW);
    expect(specials[7][0]).toBe(SPECIAL_NONE);
  });

  test("generates boards with no immediate matches and at least one possible move", () => {
    const board = makeBoard(() => 0.42);

    expect(board).toHaveLength(BOARD_ROWS);
    expect(board.every((row) => row.length === BOARD_COLS)).toBe(true);
    expect(findRuns(board)).toHaveLength(0);
    expect(findHint(board)).not.toBeNull();
  });

  test("detects when a neighboring swap would create a match", () => {
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

    expect(swapWouldMatch(board, { row: 0, col: 1 }, { row: 1, col: 1 })).toBe(true);
  });

  test("advances gem skin tiers by level while keeping logical colors stable", () => {
    expect(skinTierForLevel(1).key).toBe("classic");
    expect(skinTierForLevel(4).key).toBe("rare");
    expect(skinTierForLevel(7).key).toBe("arcane");
    expect(skinTierForLevel(11).key).toBe("celestial");
  });
});
