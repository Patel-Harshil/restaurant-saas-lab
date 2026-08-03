import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import { authRouter } from "./routes/auth.js";
import { menuRouter } from "./routes/menu.js";

// Load .env relative to this file, not process.cwd() — the preview tooling
// can spawn this script from a different working directory.
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "..", ".env") });

if (!process.env.JWT_SECRET) {
  throw new Error("JWT_SECRET is not set — copy .env.example to .env and fill it in");
}

const app = express();
app.use(cors());
app.use(express.json());

app.get("/api/health", (req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/menu", menuRouter);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`API listening on http://localhost:${port}`));
