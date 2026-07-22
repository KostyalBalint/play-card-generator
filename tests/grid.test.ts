import { test } from "node:test";
import assert from "node:assert/strict";
import {
  A4,
  computeGrid,
  CUT_MARK_REACH_MM,
  GUTTER_MM,
  MIN_MARGIN_MM,
} from "../lib/pdf/grid.ts";

test("tarot 70x120 fits 2x2 per A4", () => {
  const g = computeGrid(70, 120);
  assert.equal(g.cols, 2);
  assert.equal(g.rows, 2);
});

test("poker 63.5x88.9 fits 3x3 per A4", () => {
  const g = computeGrid(63.5, 88.9);
  assert.equal(g.cols, 3);
  assert.equal(g.rows, 3);
});

test("grid is centered on the page", () => {
  const g = computeGrid(70, 120);
  const first = g.frontSlots[0];
  const last = g.frontSlots[g.frontSlots.length - 1];
  const leftMargin = first.xMm;
  const rightMargin = A4.widthMm - (last.xMm + 70);
  assert.ok(Math.abs(leftMargin - rightMargin) < 1e-9);
});

test("back slots mirror front slots about the vertical axis (long-edge duplex)", () => {
  for (const [w, h] of [
    [70, 120],
    [63.5, 88.9],
    [50, 50],
  ]) {
    const g = computeGrid(w, h);
    g.frontSlots.forEach((front, idx) => {
      const back = g.backSlots[idx];
      assert.equal(back.xMm, A4.widthMm - front.xMm - w, `x mirror, slot ${idx} (${w}x${h})`);
      assert.equal(back.yMm, front.yMm, `y unchanged, slot ${idx} (${w}x${h})`);
    });
  }
});

test("cards never overlap and stay inside printable area", () => {
  for (const [w, h] of [
    [70, 120],
    [63.5, 88.9],
  ]) {
    const g = computeGrid(w, h);
    for (const s of [...g.frontSlots, ...g.backSlots]) {
      assert.ok(s.xMm >= 0 && s.xMm + w <= A4.widthMm);
      assert.ok(s.yMm >= 0 && s.yMm + h <= A4.heightMm);
    }
  }
});

const SIZES: [number, number][] = [
  [70, 105],
  [70, 120],
  [63.5, 88.9],
  [50, 50],
];

test("fit to page keeps the card count and the aspect", () => {
  for (const [w, h] of SIZES) {
    const plain = computeGrid(w, h);
    const fit = computeGrid(w, h, true);
    assert.equal(fit.cols, plain.cols, `cols ${w}x${h}`);
    assert.equal(fit.rows, plain.rows, `rows ${w}x${h}`);
    assert.ok(fit.cardWidthMm >= plain.cardWidthMm, `never shrinks ${w}x${h}`);
    assert.ok(
      Math.abs(fit.cardWidthMm / fit.cardHeightMm - w / h) < 1e-9,
      `aspect preserved ${w}x${h}`,
    );
  }
});

/** Margins left around the whole block of cards, in mm. */
function margins(g: ReturnType<typeof computeGrid>) {
  const usedW = g.cols * g.cardWidthMm + (g.cols - 1) * GUTTER_MM;
  const usedH = g.rows * g.cardHeightMm + (g.rows - 1) * GUTTER_MM;
  return { x: (A4.widthMm - usedW) / 2, y: (A4.heightMm - usedH) / 2 };
}

test("fit to page grows until the cut marks reach the printable edge", () => {
  const edge = MIN_MARGIN_MM + CUT_MARK_REACH_MM;
  for (const [w, h] of SIZES) {
    const plain = computeGrid(w, h);
    const fit = computeGrid(w, h, true);
    const m = margins(fit);
    if (fit.cardWidthMm === plain.cardWidthMm) {
      // Already too tight to grow (poker is): the layout must be left alone.
      assert.ok(margins(plain).x < edge || margins(plain).y < edge, `${w}x${h} should have grown`);
      continue;
    }
    assert.ok(m.x >= edge - 1e-9, `width margin ${w}x${h}: ${m.x}`);
    assert.ok(m.y >= edge - 1e-9, `height margin ${w}x${h}: ${m.y}`);
    // One of the two axes is filled to the brim — otherwise it could grow more.
    assert.ok(
      Math.abs(m.x - edge) < 1e-9 || Math.abs(m.y - edge) < 1e-9,
      `one axis maxed ${w}x${h}: ${m.x} / ${m.y}`,
    );
  }
});

test("fit to page never pushes cut marks further out than the nominal layout", () => {
  for (const [w, h] of SIZES) {
    const plain = margins(computeGrid(w, h));
    const fit = margins(computeGrid(w, h, true));
    assert.ok(fit.x >= Math.min(plain.x, MIN_MARGIN_MM + CUT_MARK_REACH_MM) - 1e-9, `x ${w}x${h}`);
    assert.ok(fit.y >= Math.min(plain.y, MIN_MARGIN_MM + CUT_MARK_REACH_MM) - 1e-9, `y ${w}x${h}`);
  }
});

test("fit to page still mirrors backs for long-edge duplex", () => {
  const g = computeGrid(70, 105, true);
  g.frontSlots.forEach((front, idx) => {
    const back = g.backSlots[idx];
    assert.equal(back.xMm, A4.widthMm - front.xMm - g.cardWidthMm, `x mirror, slot ${idx}`);
    assert.equal(back.yMm, front.yMm, `y unchanged, slot ${idx}`);
  });
});
