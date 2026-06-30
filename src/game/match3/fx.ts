export type RemovalFxPlan = {
  shardsPerGem: number;
  dustPerGem: number;
  ringRadius: number;
  flashRadius: number;
  durationMs: number;
  staggerMs: number;
  cameraShakeDurationMs: number;
  cameraShakeIntensity: number;
  chimeNotes: number[];
};

const CHIME_SCALE = [659.25, 783.99, 987.77, 1174.66, 1318.51, 1567.98];

export function removalFxPlan(removedCount: number, combo: number): RemovalFxPlan {
  const safeRemoved = Math.max(0, removedCount);
  const safeCombo = Math.max(1, combo);
  const intensity = Math.min(1, Math.max(0, (safeRemoved - 3) / 10 + (safeCombo - 1) * 0.18));
  const noteCount = Math.min(CHIME_SCALE.length, 2 + Math.floor(intensity * 3) + Math.min(2, safeCombo - 1));

  return {
    shardsPerGem: Math.min(14, 7 + Math.floor(intensity * 8)),
    dustPerGem: Math.min(8, 3 + Math.floor(intensity * 6)),
    ringRadius: Math.round(38 + intensity * 38),
    flashRadius: Math.round(34 + intensity * 46),
    durationMs: Math.round(300 + intensity * 250),
    staggerMs: Math.max(8, 24 - safeCombo * 3),
    cameraShakeDurationMs: Math.round(70 + intensity * 120),
    cameraShakeIntensity: Number((0.002 + intensity * 0.005).toFixed(4)),
    chimeNotes: CHIME_SCALE.slice(0, noteCount)
  };
}
