import Phaser from "phaser";
import { GEM_COLORS } from "./balance";
import type { GemValue, SkinTier, SkinTierKey } from "./types";

type GemShape = "brilliant" | "emerald" | "kite" | "marquise" | "shield" | "trillion";

type GemMaterial = {
  name: string;
  base: number;
  shape: GemShape;
};

export const GEM_TEXTURE_SIZE = 96;

const MATERIALS: Record<SkinTierKey, GemMaterial[]> = {
  classic: [
    { name: "紅寶石", base: 0xe83f5f, shape: "brilliant" },
    { name: "黃鑽", base: 0xf4c542, shape: "shield" },
    { name: "祖母綠", base: 0x08b77d, shape: "emerald" },
    { name: "藍寶石", base: 0x2b82d9, shape: "kite" },
    { name: "紫水晶", base: 0x8c4be8, shape: "trillion" },
    { name: "白水晶", base: 0xbfefff, shape: "marquise" }
  ],
  rare: [
    { name: "粉鑽", base: 0xff7caf, shape: "brilliant" },
    { name: "帝王托帕", base: 0xf5a623, shape: "shield" },
    { name: "橄欖石", base: 0x6bd950, shape: "emerald" },
    { name: "海藍寶", base: 0x34c6e8, shape: "kite" },
    { name: "坦桑石", base: 0x6451f2, shape: "trillion" },
    { name: "月光石", base: 0xd7e7ff, shape: "marquise" }
  ],
  arcane: [
    { name: "熔心紅晶", base: 0xff4f36, shape: "brilliant" },
    { name: "太陽琥珀", base: 0xffd166, shape: "shield" },
    { name: "森靈翠晶", base: 0x00d18f, shape: "emerald" },
    { name: "冰河星石", base: 0x18a7ff, shape: "kite" },
    { name: "夜幕晶核", base: 0xa855f7, shape: "trillion" },
    { name: "極光蛋白石", base: 0xcffcff, shape: "marquise" }
  ],
  celestial: [
    { name: "星血寶石", base: 0xff355d, shape: "brilliant" },
    { name: "星金鑽", base: 0xffe066, shape: "shield" },
    { name: "星穹祖母綠", base: 0x12f2a4, shape: "emerald" },
    { name: "星藍寶石", base: 0x4cc9ff, shape: "kite" },
    { name: "銀河紫晶", base: 0xc084fc, shape: "trillion" },
    { name: "宇光水晶", base: 0xf1fbff, shape: "marquise" }
  ]
};

export function gemTextureKey(tier: SkinTierKey, gem: GemValue) {
  return `gem-${tier}-${gem}`;
}

export function gemDisplayName(tier: SkinTierKey, gem: GemValue) {
  return MATERIALS[tier][gem]?.name ?? "未知寶石";
}

export function createGemTextures(scene: Phaser.Scene, tier: SkinTier) {
  const materials = MATERIALS[tier.key];
  for (let index = 0; index < GEM_COLORS; index += 1) {
    const key = gemTextureKey(tier.key, index as GemValue);
    if (!scene.textures.exists(key)) {
      drawGemTexture(scene, key, materials[index], tier);
    }
  }
}

function drawGemTexture(scene: Phaser.Scene, key: string, material: GemMaterial, tier: SkinTier) {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const cx = GEM_TEXTURE_SIZE / 2;
  const cy = GEM_TEXTURE_SIZE / 2;
  const base = Phaser.Display.Color.ValueToColor(material.base);
  const bright = base.clone().brighten(38 + tier.sparkle * 16).color;
  const soft = base.clone().brighten(18).color;
  const deep = base.clone().darken(34).color;
  const darkest = base.clone().darken(54).color;
  const points = shapePoints(material.shape, cx, cy);

  g.fillStyle(0x000000, 0.38);
  g.fillEllipse(cx + 2, cy + 13, 66, 22);
  g.lineStyle(5, darkest, 0.98);
  g.fillStyle(deep, 1);
  g.fillPoints(points, true);
  g.strokePoints(points, true);
  g.lineStyle(2, tier.rimLight, 0.62);
  g.strokePoints(points.map((point) => point.clone().lerp(new Phaser.Math.Vector2(cx, cy), 0.04)), true);

  drawFacets(g, points, cx, cy, bright, soft, deep, darkest);
  drawCutLines(g, points, cx, cy, tier.rimLight);
  drawGlints(g, cx, cy, tier);

  if (tier.key === "arcane" || tier.key === "celestial") {
    g.lineStyle(tier.key === "celestial" ? 3 : 2, 0xffffff, tier.key === "celestial" ? 0.42 : 0.28);
    g.strokeCircle(cx, cy, tier.key === "celestial" ? 39 : 34);
  }

  g.generateTexture(key, GEM_TEXTURE_SIZE, GEM_TEXTURE_SIZE);
  g.destroy();
}

function shapePoints(shape: GemShape, cx: number, cy: number) {
  const v = Phaser.Math.Vector2;
  switch (shape) {
    case "emerald":
      return [
        new v(cx - 26, cy - 36),
        new v(cx + 26, cy - 36),
        new v(cx + 39, cy - 20),
        new v(cx + 34, cy + 28),
        new v(cx + 20, cy + 40),
        new v(cx - 20, cy + 40),
        new v(cx - 34, cy + 28),
        new v(cx - 39, cy - 20)
      ];
    case "kite":
      return [
        new v(cx, cy - 43),
        new v(cx + 34, cy - 12),
        new v(cx + 24, cy + 34),
        new v(cx, cy + 43),
        new v(cx - 24, cy + 34),
        new v(cx - 34, cy - 12)
      ];
    case "marquise":
      return [
        new v(cx, cy - 43),
        new v(cx + 30, cy - 26),
        new v(cx + 42, cy),
        new v(cx + 29, cy + 27),
        new v(cx, cy + 43),
        new v(cx - 29, cy + 27),
        new v(cx - 42, cy),
        new v(cx - 30, cy - 26)
      ];
    case "shield":
      return [
        new v(cx - 36, cy - 24),
        new v(cx - 16, cy - 40),
        new v(cx + 16, cy - 40),
        new v(cx + 36, cy - 24),
        new v(cx + 31, cy + 23),
        new v(cx, cy + 43),
        new v(cx - 31, cy + 23)
      ];
    case "trillion":
      return [
        new v(cx, cy - 43),
        new v(cx + 40, cy + 29),
        new v(cx + 22, cy + 42),
        new v(cx - 22, cy + 42),
        new v(cx - 40, cy + 29)
      ];
    case "brilliant":
    default:
      return [
        new v(cx, cy - 42),
        new v(cx + 30, cy - 30),
        new v(cx + 42, cy),
        new v(cx + 30, cy + 30),
        new v(cx, cy + 42),
        new v(cx - 30, cy + 30),
        new v(cx - 42, cy),
        new v(cx - 30, cy - 30)
      ];
  }
}

function drawFacets(
  g: Phaser.GameObjects.Graphics,
  points: Phaser.Math.Vector2[],
  cx: number,
  cy: number,
  bright: number,
  soft: number,
  deep: number,
  darkest: number
) {
  const center = new Phaser.Math.Vector2(cx, cy + 3);
  points.forEach((point, index) => {
    const next = points[(index + 1) % points.length];
    const color = index % 4 === 0 ? bright : index % 4 === 1 ? soft : index % 4 === 2 ? deep : darkest;
    g.fillStyle(color, index % 2 === 0 ? 0.82 : 0.64);
    g.fillPoints([point, next, center], true);
  });

  g.fillStyle(0xffffff, 0.22);
  g.fillPoints(
    [
      new Phaser.Math.Vector2(cx - 22, cy - 30),
      new Phaser.Math.Vector2(cx + 16, cy - 31),
      new Phaser.Math.Vector2(cx + 3, cy - 4),
      new Phaser.Math.Vector2(cx - 31, cy - 8)
    ],
    true
  );
  g.fillStyle(0x000000, 0.18);
  g.fillPoints(
    [
      new Phaser.Math.Vector2(cx + 9, cy + 4),
      new Phaser.Math.Vector2(cx + 35, cy + 4),
      new Phaser.Math.Vector2(cx + 20, cy + 34),
      new Phaser.Math.Vector2(cx - 2, cy + 27)
    ],
    true
  );
}

function drawCutLines(g: Phaser.GameObjects.Graphics, points: Phaser.Math.Vector2[], cx: number, cy: number, rim: number) {
  const center = new Phaser.Math.Vector2(cx, cy + 3);
  g.lineStyle(1, 0xffffff, 0.35);
  points.forEach((point) => {
    g.strokeLineShape(new Phaser.Geom.Line(point.x, point.y, center.x, center.y));
  });
  g.lineStyle(1, rim, 0.4);
  for (let index = 0; index < points.length; index += 2) {
    const a = points[index];
    const b = points[(index + 2) % points.length];
    g.strokeLineShape(new Phaser.Geom.Line(a.x, a.y, b.x, b.y));
  }
}

function drawGlints(g: Phaser.GameObjects.Graphics, cx: number, cy: number, tier: SkinTier) {
  g.fillStyle(0xffffff, 0.86);
  g.fillEllipse(cx - 16, cy - 18, 12, 5);
  g.fillCircle(cx + 12, cy - 26, 3.5);
  g.fillStyle(0xffffff, 0.48);
  g.fillCircle(cx + 24, cy + 13, 2.6);

  if (tier.sparkle > 0.75) {
    g.lineStyle(2, 0xffffff, 0.74);
    g.strokeLineShape(new Phaser.Geom.Line(cx - 31, cy - 32, cx - 31, cy - 18));
    g.strokeLineShape(new Phaser.Geom.Line(cx - 38, cy - 25, cx - 24, cy - 25));
  }
}
