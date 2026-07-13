import { GEM_COLORS } from "./balance";
import type { GemValue } from "./types";

export class GemRefillQueue {
  private values: GemValue[];
  private readonly size: number;
  private readonly random: () => number;
  revision = 0;

  constructor(random: () => number = Math.random, previewSize = 6) {
    this.random = random;
    this.size = Math.max(1, Math.floor(previewSize));
    this.values = Array.from({ length: this.size }, () => this.createNormalGem());
  }

  next() {
    const value = this.values.shift()!;
    this.values.push(this.createNormalGem());
    this.revision += 1;
    return value;
  }

  preview(count = this.size) {
    return this.values.slice(0, Math.max(0, Math.floor(count)));
  }

  private createNormalGem(): GemValue {
    const raw = this.random();
    const normalized = Number.isFinite(raw) ? Math.min(0.999999, Math.max(0, raw)) : 0;
    return Math.floor(normalized * GEM_COLORS) as GemValue;
  }
}
