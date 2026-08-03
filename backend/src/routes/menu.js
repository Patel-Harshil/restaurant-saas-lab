import { Router } from "express";
import { menuItems, createMenuItem, updateMenuItem, deleteMenuItem } from "../data/store.js";
import { requireAuth } from "../middleware/requireAuth.js";

export const menuRouter = Router();

// Reading the menu is public — a diner doesn't need an account to see it.
menuRouter.get("/", (req, res) => {
  res.json(menuItems);
});

// Writes require auth — only a logged-in owner/staff member manages the menu.
menuRouter.post("/", requireAuth, (req, res) => {
  const { name, price, category } = req.body;
  if (!name || typeof price !== "number" || price < 0) {
    return res.status(400).json({ error: "name and a non-negative numeric price are required" });
  }
  res.status(201).json(createMenuItem({ name, price, category }));
});

menuRouter.put("/:id", requireAuth, (req, res) => {
  const updated = updateMenuItem(req.params.id, req.body);
  if (!updated) return res.status(404).json({ error: "Menu item not found" });
  res.json(updated);
});

menuRouter.delete("/:id", requireAuth, (req, res) => {
  const deleted = deleteMenuItem(req.params.id);
  if (!deleted) return res.status(404).json({ error: "Menu item not found" });
  res.status(204).send();
});
