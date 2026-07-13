import { describe, expect, test } from "vitest";
import { GemRefillQueue } from "./refillQueue";

describe("GemRefillQueue", () => {
  test("previews and consumes the exact FIFO refill order", () => {
    const values = [0, 0.18, 0.35, 0.52, 0.69, 0.86, 0.99];
    let index = 0;
    const queue = new GemRefillQueue(() => values[index++] ?? 0, 6);

    expect(queue.preview()).toEqual([0, 1, 2, 3, 4, 5]);
    expect(queue.revision).toBe(0);

    expect(queue.next()).toBe(0);
    expect(queue.preview()).toEqual([1, 2, 3, 4, 5, 5]);
    expect(queue.revision).toBe(1);
  });

  test("keeps every generated value inside the six normal gem colors", () => {
    const values = [-1, 0, 0.999, 1, 4];
    let index = 0;
    const queue = new GemRefillQueue(() => values[index++] ?? 0.5, 5);

    expect(queue.preview()).toEqual([0, 0, 5, 5, 5]);
    expect(queue.preview(3)).toEqual([0, 0, 5]);
  });
});
