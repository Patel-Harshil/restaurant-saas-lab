import { useEffect, useState } from "react";
import { api } from "../api";

export function MenuManager({ token }) {
  const [items, setItems] = useState([]);
  const [status, setStatus] = useState("loading"); // "loading" | "ready" | "error"
  const [error, setError] = useState(null);
  const [form, setForm] = useState({ name: "", price: "", category: "" });

  useEffect(() => {
    loadMenu();
  }, []);

  async function loadMenu() {
    setStatus("loading");
    try {
      setItems(await api.listMenu());
      setStatus("ready");
    } catch (err) {
      setError(err.message);
      setStatus("error");
    }
  }

  async function handleAdd(e) {
    e.preventDefault();
    try {
      await api.createMenuItem(token, { ...form, price: Number(form.price) });
      setForm({ name: "", price: "", category: "" });
      loadMenu();
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleToggleAvailable(item) {
    await api.updateMenuItem(token, item.id, { available: !item.available });
    loadMenu();
  }

  async function handleDelete(id) {
    await api.deleteMenuItem(token, id);
    loadMenu();
  }

  if (status === "loading") return <p>Loading menu…</p>;
  if (status === "error") return <p className="error" role="alert">Couldn't load the menu: {error}</p>;

  return (
    <section>
      <h2>Menu</h2>
      {items.length === 0 ? (
        <p>No menu items yet — add the first one below.</p>
      ) : (
        <ul className="menu-list">
          {items.map((item) => (
            <li key={item.id} className={item.available ? "" : "unavailable"}>
              <span>{item.name}</span>
              <span>₹{item.price}</span>
              <span>{item.category}</span>
              {token && (
                <>
                  <button type="button" onClick={() => handleToggleAvailable(item)}>
                    {item.available ? "Mark 86'd" : "Mark available"}
                  </button>
                  <button type="button" onClick={() => handleDelete(item.id)}>
                    Delete
                  </button>
                </>
              )}
            </li>
          ))}
        </ul>
      )}

      {token && (
        <form className="add-item-form" onSubmit={handleAdd}>
          <h3>Add a menu item</h3>
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            placeholder="Price"
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />
          <input
            placeholder="Category"
            value={form.category}
            onChange={(e) => setForm({ ...form, category: e.target.value })}
          />
          <button type="submit">Add</button>
        </form>
      )}
    </section>
  );
}
