import { test } from "node:test";
import assert from "node:assert/strict";
import { MAP_COLS, MAP_ROWS, MAP_TILES, mapSizeMm, mapTileRects, masterTileMm } from "../lib/maps.ts";

const CARD = { widthMm: 70, heightMm: 105 };

test("tiles cover the master exactly, no gaps or overlap", () => {
  for (const [W, H] of [
    [1024, 1536],
    [1023, 1537], // odd sizes → rounding must be absorbed
    [1000, 1000],
  ]) {
    const rects = mapTileRects(W, H);
    assert.equal(rects.length, MAP_TILES);
    const area = rects.reduce((sum, r) => sum + r.width * r.height, 0);
    assert.equal(area, W * H, `covered area ${W}x${H}`);
    for (const r of rects) {
      assert.ok(r.left >= 0 && r.left + r.width <= W);
      assert.ok(r.top >= 0 && r.top + r.height <= H);
      assert.ok(r.width > 0 && r.height > 0);
    }
  }
});

test("tiles are laid out row-major (A B / C D)", () => {
  const rects = mapTileRects(1024, 1536);
  assert.deepEqual(
    rects.map((r) => [r.left, r.top]),
    [
      [0, 0],
      [512, 0],
      [0, 768],
      [512, 768],
    ],
  );
});

test("a landscape map is the same grid on its side", () => {
  assert.deepEqual(mapSizeMm(CARD, false), { widthMm: 140, heightMm: 210 });
  assert.deepEqual(mapSizeMm(CARD, true), { widthMm: 210, heightMm: 140 });
  // Portrait master → 1024x1536, landscape master → 1536x1024 (ratio crosses 1.1).
  assert.ok(mapSizeMm(CARD, true).widthMm / mapSizeMm(CARD, true).heightMm > 1.1);
});

test("master tiles lie on their side for a landscape map", () => {
  assert.deepEqual(masterTileMm(CARD, false), CARD);
  assert.deepEqual(masterTileMm(CARD, true), { widthMm: 105, heightMm: 70 });
  // The master's aspect is the tile's aspect either way — the grid is square.
  for (const landscape of [false, true]) {
    const map = mapSizeMm(CARD, landscape);
    const tile = masterTileMm(CARD, landscape);
    assert.ok(Math.abs(map.widthMm / map.heightMm - tile.widthMm / tile.heightMm) < 1e-9);
  }
});

test("a square grid keeps the tile aspect equal to the master aspect", () => {
  assert.equal(MAP_COLS, MAP_ROWS);
  const [W, H] = [1024, 1536];
  const r = mapTileRects(W, H)[0];
  assert.ok(Math.abs(r.width / r.height - W / H) < 1e-9);
});
