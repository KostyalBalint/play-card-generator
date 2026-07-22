import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_OVERLAY_STYLE,
  MARGIN_FRAC,
  OVERLAY_FONTS,
  parseOverlayStyle,
  placement,
  plateFill,
} from "../lib/overlaystyle.ts";

test("legacy plate presets map onto the colour + opacity fields", () => {
  const dark = parseOverlayStyle({ label: { plate: "dark" } }).label;
  assert.equal(dark.plateColor, "#000000");
  assert.equal(dark.plateOpacity, 55);
  const light = parseOverlayStyle({ label: { plate: "light" } }).label;
  assert.equal(light.plateColor, "#ffffff");
  assert.equal(light.plateOpacity, 80);
  // "none" was the no-plate preset — now zero opacity, so plateFill() drops it.
  const none = parseOverlayStyle({ label: { plate: "none" } }).label;
  assert.equal(none.plateOpacity, 0);
  assert.equal(plateFill(none), null);
});

test("opacity is clamped and drives the plate fill", () => {
  const s = parseOverlayStyle({ label: { textOpacity: 140, plateOpacity: 100 } }).label;
  assert.equal(s.textOpacity, 100);
  assert.deepEqual(plateFill(s), { color: "#000000", opacity: 1 });
});

test("every catalogued font is accepted, unknown ones are not", () => {
  for (const f of OVERLAY_FONTS) {
    assert.equal(parseOverlayStyle({ label: { font: f } }).label.font, f);
  }
  assert.equal(parseOverlayStyle({ label: { font: "comic" } }).label.font, "sans");
});

test("parseOverlayStyle falls back to the default for missing or bogus values", () => {
  assert.deepEqual(parseOverlayStyle(null), DEFAULT_OVERLAY_STYLE);
  assert.deepEqual(parseOverlayStyle({ label: { anchor: "nope", color: "red" } }).label, {
    ...DEFAULT_OVERLAY_STYLE.label,
  });
  // Out-of-range numbers are clamped, valid values kept.
  const parsed = parseOverlayStyle({ caption: { sizePct: 999, offsetXPct: -12, bold: true } }).caption;
  assert.equal(parsed.sizePct, 40);
  assert.equal(parsed.offsetXPct, -12);
  assert.equal(parsed.bold, true);
  assert.equal(parsed.anchor, DEFAULT_OVERLAY_STYLE.caption.anchor);
});

test("the default style reproduces the historic centred label + bottom caption", () => {
  const aspect = 70 / 120;
  assert.deepEqual(placement(DEFAULT_OVERLAY_STYLE.label, aspect), {
    xFrac: 0.5,
    yFrac: 0.5,
    alignX: "center",
    alignY: "center",
  });
  const cap = placement(DEFAULT_OVERLAY_STYLE.caption, aspect);
  // The bottom margin is width-based, so it reads the same as the side margins.
  assert.equal(cap.yFrac, 1 - MARGIN_FRAC * aspect);
  assert.equal(cap.alignY, "end");
  assert.equal(cap.alignX, "center");
});

test("corner anchors sit inside the margin and nudges shift from there", () => {
  const aspect = 0.5;
  const p = placement(
    { ...DEFAULT_OVERLAY_STYLE.label, anchor: "top-right", offsetXPct: -10, offsetYPct: 5 },
    aspect,
  );
  assert.equal(p.xFrac, 1 - MARGIN_FRAC - 0.1);
  assert.equal(p.yFrac, MARGIN_FRAC * aspect + 0.05);
  assert.equal(p.alignX, "end");
  assert.equal(p.alignY, "start");
});
