import { describe, expect, test } from "vitest";
import { pointerToBoardCell } from "./input";

const metrics = {
  boardX: 60.5,
  boardY: 112,
  gemSize: 68,
  gap: 7,
  boardRows: 10,
  boardCols: 8
};

describe("match-3 board input mapping", () => {
  test("maps a pointer at the center of a gem to that board cell", () => {
    expect(pointerToBoardCell(94.5, 146, metrics)).toEqual({ row: 0, col: 0 });
  });

  test("keeps edge and gap clicks forgiving by snapping to the nearest cell", () => {
    expect(pointerToBoardCell(130.5, 146, metrics, 6)).toEqual({ row: 0, col: 0 });
    expect(pointerToBoardCell(133.5, 146, metrics, 6)).toEqual({ row: 0, col: 1 });
  });

  test("rejects pointers beyond the forgiving board bounds", () => {
    expect(pointerToBoardCell(42, 146, metrics, 6)).toBeNull();
    expect(pointerToBoardCell(94.5, 94, metrics, 6)).toBeNull();
  });

  test("maps the bottom-right gem correctly", () => {
    expect(pointerToBoardCell(619.5, 821, metrics)).toEqual({ row: 9, col: 7 });
  });
});
