export type GemValue = -1 | 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type SpecialValue = 0 | 1 | 2 | 3;

export type Cell = {
  row: number;
  col: number;
};

export type Board = GemValue[][];
export type SpecialBoard = SpecialValue[][];

export type MatchDirection = "horizontal" | "vertical";

export type MatchRun = {
  direction: MatchDirection;
  cells: Cell[];
  length: number;
};

export type SpecialCreation = Cell & {
  special: SpecialValue;
};

export type MatchPlan = {
  matched: Set<number>;
  creations: SpecialCreation[];
  creationKeys: Set<number>;
};

export type SkinTierKey = "classic" | "rare" | "arcane" | "celestial";

export type SkinTier = {
  key: SkinTierKey;
  name: string;
  minLevel: number;
  sparkle: number;
  rimLight: number;
};

export type RoundSummary = {
  levelScore: number;
  totalScore: number;
  highestCombo: number;
  bestScore: number;
  bestLevel: number;
  newBest: boolean;
};

export type OverlayState = {
  mode: "menu" | "pause" | "level" | "gameover";
  title: string;
  text: string;
  big?: string;
  button: string;
  summary?: RoundSummary;
};
