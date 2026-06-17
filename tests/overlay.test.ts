import { test } from "node:test";
import assert from "node:assert/strict";
import { overlayLabelFor } from "../lib/overlay.ts";

test("overlayLabelFor draws item number over the (shared) back regardless of face flag", () => {
  assert.equal(overlayLabelFor({ isItem: true, number: 3 }, { labelOverlay: false }), "3");
  assert.equal(overlayLabelFor({ isItem: true, number: 1 }, null), "1");
  assert.equal(overlayLabelFor({ isItem: true, number: null }, { labelOverlay: true }), null);
});

test("overlayLabelFor keeps panorama behavior for non-items", () => {
  // Only flagged faces overlay; text is backText override else position label.
  assert.equal(overlayLabelFor({ positionLabel: "B" }, { labelOverlay: true }), "B");
  assert.equal(overlayLabelFor({ backText: "X", positionLabel: "B" }, { labelOverlay: true }), "X");
  assert.equal(overlayLabelFor({ positionLabel: "B" }, { labelOverlay: false }), null);
  assert.equal(overlayLabelFor({ positionLabel: "B" }, null), null);
});
