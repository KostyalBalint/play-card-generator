import { test } from "node:test";
import assert from "node:assert/strict";
import { A4, computeGrid } from "../lib/pdf/grid.ts";

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
