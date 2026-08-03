// Day 1: plain in-memory arrays standing in for a database.
// Day 2 replaces this whole file with real Postgres queries — nothing
// outside this file should know or care how storage actually works.
let nextUserId = 1;
let nextMenuItemId = 1;

export const users = [];

export const menuItems = [
  { id: nextMenuItemId++, name: "Paneer Tikka", price: 220, category: "Starters", available: true },
  { id: nextMenuItemId++, name: "Butter Chicken", price: 320, category: "Mains", available: true },
  { id: nextMenuItemId++, name: "Gulab Jamun", price: 90, category: "Desserts", available: true },
];

export function createUser({ email, passwordHash }) {
  const user = { id: nextUserId++, email, passwordHash, role: "owner" };
  users.push(user);
  return user;
}

export function findUserByEmail(email) {
  return users.find((u) => u.email === email);
}

export function createMenuItem(data) {
  const item = { id: nextMenuItemId++, available: true, ...data };
  menuItems.push(item);
  return item;
}

export function updateMenuItem(id, patch) {
  const item = menuItems.find((m) => m.id === Number(id));
  if (!item) return null;
  Object.assign(item, patch);
  return item;
}

export function deleteMenuItem(id) {
  const index = menuItems.findIndex((m) => m.id === Number(id));
  if (index === -1) return false;
  menuItems.splice(index, 1);
  return true;
}
