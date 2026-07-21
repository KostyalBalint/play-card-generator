import { test } from "node:test";
import assert from "node:assert/strict";
import { overlayFor } from "../lib/overlay.ts";

test("overlayFor draws item number over the (shared) back regardless of face flag", () => {
  assert.deepEqual(overlayFor({ isItem: true, number: 3 }, { labelOverlay: false }), {
    label: "3",
    caption: null,
  });
  assert.deepEqual(overlayFor({ isItem: true, number: 1 }, null), { label: "1", caption: null });
  assert.equal(overlayFor({ isItem: true, number: null }, { labelOverlay: true }), null);
});

test("overlayFor keeps panorama behavior for non-items", () => {
  // Only flagged faces overlay; text is backText override else position label,
  // and it goes in the small bottom caption so the artwork stays clear.
  assert.deepEqual(overlayFor({ positionLabel: "B" }, { labelOverlay: true }), {
    label: null,
    caption: "B",
  });
  assert.deepEqual(overlayFor({ backText: "X", positionLabel: "B" }, { labelOverlay: true }), {
    label: null,
    caption: "X",
  });
  assert.equal(overlayFor({ positionLabel: "B" }, { labelOverlay: false }), null);
  assert.equal(overlayFor({ positionLabel: "B" }, null), null);
});

test("card-driven labelOverlay centres the letter and captions with the location name", () => {
  assert.deepEqual(overlayFor({ positionLabel: "A", labelOverlay: true }, null, "Cellar"), {
    label: "A",
    caption: "Cellar",
  });
  assert.deepEqual(
    overlayFor({ positionLabel: "A", labelOverlay: true, overlayCaption: "Entrance" }, null, "Cellar"),
    { label: "A", caption: "Entrance" },
  );
});

test("map cards get no overlay — they are laid out face-up with identical backs", () => {
  assert.equal(overlayFor({ positionLabel: "A" }, { labelOverlay: false }), null);
});
