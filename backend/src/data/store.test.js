import { test } from "node:test";
import assert from "node:assert/strict";
import { createMenuItem, updateMenuItem, deleteMenuItem, menuItems } from "./store.js";

test("createMenuItem defaults available to true", () => {
  const item = createMenuItem({ name: "Test Item", price: 100, category: "Test" });
  assert.equal(item.available, true);
  assert.equal(item.name, "Test Item");
});

test("updateMenuItem patches an existing item", () => {
  const item = createMenuItem({ name: "Patch Me", price: 50, category: "Test" });
  const updated = updateMenuItem(item.id, { available: false });
  assert.equal(updated.available, false);
  assert.equal(updated.name, "Patch Me");
});

test("updateMenuItem returns null for a missing id", () => {
  assert.equal(updateMenuItem(999999, { available: false }), null);
});

test("deleteMenuItem removes the item and returns true", () => {
  const item = createMenuItem({ name: "Delete Me", price: 10, category: "Test" });
  const before = menuItems.length;
  assert.equal(deleteMenuItem(item.id), true);
  assert.equal(menuItems.length, before - 1);
});

test("deleteMenuItem returns false for a missing id", () => {
  assert.equal(deleteMenuItem(999999), false);
});
