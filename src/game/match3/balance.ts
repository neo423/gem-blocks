import type { SkinTier } from "./types";

export const BOARD_ROWS = 10;
export const BOARD_COLS = 8;
export const BOARD_SIZE = BOARD_COLS;
export const GEM_COLORS = 6;
export const EMPTY_GEM = -1;
export const ULTIMATE_GEM = 6;

export const SPECIAL_NONE = 0;
export const SPECIAL_ROW = 1;
export const SPECIAL_COLUMN = 2;
export const SPECIAL_ULTIMATE = 3;

export const SHUFFLES_PER_LEVEL = 3;
export const BASE_LEVEL_TIME_SECONDS = 150;
export const BASE_TARGET_SCORE = 1300;
export const TARGET_GROWTH = 1.34;

export const GEM_SCORE = 12;
export const COMBO_BONUS = 0.45;

export const SKIN_TIERS: SkinTier[] = [
  { key: "classic", name: "經典切面", minLevel: 1, sparkle: 0.55, rimLight: 0xffffff },
  { key: "rare", name: "稀有寶石", minLevel: 4, sparkle: 0.72, rimLight: 0xfff1b8 },
  { key: "arcane", name: "魔法水晶", minLevel: 7, sparkle: 0.9, rimLight: 0xbff7ff },
  { key: "celestial", name: "星辰寶石", minLevel: 11, sparkle: 1, rimLight: 0xf6e6ff }
];

export function targetForLevel(level: number) {
  return Math.round((BASE_TARGET_SCORE * Math.pow(TARGET_GROWTH, level - 1)) / 100) * 100;
}

export function scoreForRemoval(removedCount: number, combo: number) {
  return Math.round(removedCount * GEM_SCORE * (1 + Math.max(0, combo - 1) * COMBO_BONUS));
}
