import { test } from "node:test";
import assert from "node:assert/strict";
import { labelForIndex, buildBackText } from "../lib/locations.ts";

test("labelForIndex bijective base-26", () => {
  assert.equal(labelForIndex(0), "A");
  assert.equal(labelForIndex(1), "B");
  assert.equal(labelForIndex(25), "Z");
  assert.equal(labelForIndex(26), "AA");
  assert.equal(labelForIndex(27), "AB");
  assert.equal(labelForIndex(51), "AZ");
  assert.equal(labelForIndex(52), "BA");
});

test("buildBackText prefers override then label", () => {
  assert.equal(buildBackText({ backText: "No entry", positionLabel: "B" }), "No entry");
  assert.equal(buildBackText({ backText: "  ", positionLabel: "B" }), "B");
  assert.equal(buildBackText({ backText: null, positionLabel: "C" }), "C");
  assert.equal(buildBackText({ backText: null, positionLabel: null }), "");
});
