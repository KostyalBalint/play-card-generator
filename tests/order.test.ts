import { test } from "node:test";
import assert from "node:assert/strict";
import { orderCardsForExport, type OrderableCard } from "../lib/pdf/order.ts";

type Card = OrderableCard & { name: string };

const card = (name: string, over: Partial<OrderableCard> = {}): Card => ({
  name,
  location: null,
  map: null,
  isItem: false,
  number: null,
  orderIndex: 0,
  ...over,
});

const names = (cards: Card[]) => orderCardsForExport(cards).map((c) => c.name);

test("tiers print maps, then items, then located cards, then loose ones", () => {
  const cards = [
    card("loose"),
    card("located", { location: { orderIndex: 0 } }),
    card("item", { isItem: true, number: 1 }),
    card("map", { map: { orderIndex: 0 } }),
  ];
  assert.deepEqual(names(cards), ["map", "item", "located", "loose"]);
});

test("maps go by map order, then by the card's own order (quadrant A→D)", () => {
  const cards = [
    card("m2-B", { map: { orderIndex: 1 }, orderIndex: 1 }),
    card("m1-B", { map: { orderIndex: 0 }, orderIndex: 1 }),
    card("m2-A", { map: { orderIndex: 1 }, orderIndex: 0 }),
    card("m1-A", { map: { orderIndex: 0 }, orderIndex: 0 }),
  ];
  assert.deepEqual(names(cards), ["m1-A", "m1-B", "m2-A", "m2-B"]);
});

test("items go by number, falling back to card order", () => {
  const cards = [
    card("three", { isItem: true, number: 3 }),
    card("one", { isItem: true, number: 1 }),
    card("unnumbered-late", { isItem: true, orderIndex: 5 }),
    card("unnumbered-early", { isItem: true, orderIndex: 2 }),
  ];
  assert.deepEqual(names(cards), ["unnumbered-early", "unnumbered-late", "one", "three"]);
});

test("located cards go location by location, A→N inside each", () => {
  // orderIndex mirrors positionLabel — actions/locations keeps them in lockstep.
  const cards = [
    card("loc2-B", { location: { orderIndex: 1 }, orderIndex: 1 }),
    card("loc1-C", { location: { orderIndex: 0 }, orderIndex: 2 }),
    card("loc2-A", { location: { orderIndex: 1 }, orderIndex: 0 }),
    card("loc1-A", { location: { orderIndex: 0 }, orderIndex: 0 }),
    card("loc1-B", { location: { orderIndex: 0 }, orderIndex: 1 }),
  ];
  assert.deepEqual(names(cards), ["loc1-A", "loc1-B", "loc1-C", "loc2-A", "loc2-B"]);
});

test("a map member sitting in a location still prints with its map", () => {
  const cards = [
    card("plain-located", { location: { orderIndex: 0 } }),
    card("map-member", { map: { orderIndex: 0 }, location: { orderIndex: 0 } }),
  ];
  assert.deepEqual(names(cards), ["map-member", "plain-located"]);
});

test("the input array is left untouched", () => {
  const cards = [card("loose"), card("map", { map: { orderIndex: 0 } })];
  orderCardsForExport(cards);
  assert.deepEqual(cards.map((c) => c.name), ["loose", "map"]);
});
