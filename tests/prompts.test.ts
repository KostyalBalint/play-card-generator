import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPromptWithReference } from "../lib/prompts.ts";

const FACE = {
  textLayout: "TITLE_BANNER" as const,
  title: "Lantern",
  bodyText: null,
  imagePrompt: "a rusted oil lantern on a workbench",
};
const SET = { stylePrompt: "grim 1920s noir", widthMm: 70, heightMm: 105 };

test("back reference keeps the same-card wording", () => {
  const p = buildPromptWithReference(FACE, SET, null, "back");
  assert.match(p, /different side\/scene of the same card/);
  // Still the face's own prompt + style, not the reference's.
  assert.match(p, /rusted oil lantern/);
  assert.match(p, /grim 1920s noir/);
});

test("card reference asks for the deck's look but this face's subject", () => {
  const p = buildPromptWithReference(FACE, SET, null, "card");
  assert.match(p, /another card from the same deck/);
  assert.match(p, /not the reference's subject/);
  assert.doesNotMatch(p, /same side\/scene|different side\/scene/);
  assert.match(p, /rusted oil lantern/);
});

test("kind defaults to back so existing calls are unchanged", () => {
  assert.equal(buildPromptWithReference(FACE, SET, null), buildPromptWithReference(FACE, SET, null, "back"));
});
