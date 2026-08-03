# Node.js & Express Fundamentals

## What Node.js actually is

Plain English first: Node.js is just "JavaScript, but not in a browser tab." Before Node existed, JavaScript could only run inside a webpage — it moved buttons, validated forms, updated the DOM. Node took the same JS language (and Chrome's V8 engine that executes it) and bolted it onto a standalone program you run from a terminal. Once JS could run outside a browser, it could do things a browser script never could: open a TCP socket, read a file off disk, listen on a port, talk to a database.

That's exactly what's happening at the top of `backend/src/index.js`. Lines 1–2 import from `node:url` and `node:path` — these are **Node's built-in modules**, not npm packages, and they don't exist in browser JS at all:

```js
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
```

A browser script can't ask "what's the absolute path to the file I'm running from" — there's no filesystem concept in a browser sandbox. Node gives you that because Node's whole job is to be the thing your server process runs *as*.

Why backends specifically use Node (and not, say, only Python or Java) comes down to one practical fact: your frontend and backend can now share one language. `frontend/package.json` confirms this directly — `"react": "^19.2.8"`, built with Vite — so the frontend (React) and this Express API are both JavaScript, no hedging needed. You're not context-switching syntax between "the file that renders the menu" and "the file that serves the menu data." That's a real cost saved, not just a buzzword.

**Alternative and why this project didn't take it:** you could write this backend in Python (Flask/FastAPI), Go, or Java (Spring). Those are legitimate, often faster or more type-safe choices for heavy compute. This is a learning-focused restaurant SaaS lab, and the tradeoff made here is "one language across the whole stack, fast to iterate, huge ecosystem of examples" over "best raw performance for CPU-heavy work." Node is a poor fit if you were doing video encoding or heavy number-crunching on the server — it's a great fit for what this app actually does: shuffle JSON between a database and a browser, which is I/O, not computation.

## The event loop — why Node doesn't block on I/O

Plain English first: imagine a single waiter running an entire restaurant. A *blocking* waiter takes your order, walks it to the kitchen, stands there staring at the pan until your food is done, brings it back, and only then looks at the next table. A *non-blocking* waiter drops your order at the kitchen window, immediately goes to take the next table's order, and only comes back to your table when the kitchen calls out that your plate is ready. One waiter, but nobody in the restaurant is stuck waiting on them.

Node runs your JavaScript on a **single thread**. If Node blocked while waiting on I/O (disk reads, network calls, database queries), that one thread would be frozen and unable to serve any other request in the meantime — a disaster for a server handling many users at once. Instead, Node hands the I/O work off to the underlying system (via `libuv`), keeps running other code, and gets notified through a callback/Promise when the I/O finishes. That notification-and-resume mechanism is the **event loop**: a continuous cycle where Node checks "is there finished I/O work with a callback waiting to run? If so, run it; otherwise keep executing whatever's next."

You can see the *shape* of this directly in `auth.js`. Look at the login route:

```js
authRouter.post("/login", async (req, res) => {   // auth.js:24
  const { email, password } = req.body;
  const user = findUserByEmail(email);

  const passwordMatches = user && (await bcrypt.compare(password, user.passwordHash)); // auth.js:28
  ...
```

`bcrypt.compare` (auth.js:28) is deliberately expensive — bcrypt's whole security model depends on hashing being slow so brute-forcing is impractical. If this were synchronous and blocking, that one login request would freeze the entire server for everyone else while the hash was computed. Instead, `bcrypt.compare` returns a Promise, and `await` (inside the `async` function declared at auth.js:24) suspends *this specific request's* execution without blocking the thread.

Here's a wrinkle worth being precise about, though: auth.js:2 imports from `bcryptjs`, not the native `bcrypt` package. Native `bcrypt` is a C++ addon that really does offload hashing to libuv's thread pool — a genuinely separate OS thread doing the work while the JS thread keeps serving other requests. `bcryptjs` is pure JavaScript with no thread pool underneath it; there's nowhere else to hand the work off to on a single thread. What it does instead is break the hash into small chunks and yield control back to the event loop between chunks (via `setImmediate`), so a *different* request's callback gets a turn to run before the next chunk resumes. That's cooperative interleaving on the same thread, not background execution on another one — closer to the waiter checking in on three tables in quick succession than to a second waiter working the kitchen. It's a meaningfully different mechanism from the disk-read/network-call I/O this section opened with, which really does get handed off to the OS — even though from the `await`ing code's point of view, both just look like "the Promise resolves later." Node goes off and services other incoming requests (like someone else hitting `/api/health` at index.js:22) between those chunks, then resumes exactly where it left off once the Promise settles.

`jwt.sign` at auth.js:33–37, by contrast, is synchronous CPU work — it doesn't touch disk or network, so there's nothing to "wait on"; it just runs and returns.

**Alternative and why this project uses `async/await`:** the same non-blocking behavior used to be written with raw callbacks (`bcrypt.compare(pw, hash, (err, result) => {...})`) or `.then()` chains. `async/await` is syntactic sugar over Promises — same event-loop mechanics underneath, just written to *look* like sequential, top-to-bottom code. That readability is exactly why `register` (auth.js:8) and `login` (auth.js:24) are both declared `async` — it lets you write `await bcrypt.hash(...)` (auth.js:18) instead of nesting a callback, while still never blocking the one thread everyone's requests share.

## What Express adds on top of raw Node

Plain English first: raw Node gives you an `http` module that can technically build a server, but you'd be manually parsing URLs, reading request bodies chunk by chunk, and writing your own routing logic (`if url === "/api/auth/login" and method === "POST"...`) for every single endpoint. Express is a thin layer that does that repetitive plumbing for you and gives you a clean, declarative way to say "when a POST hits this path, run this function."

That declarative style is the whole file structure of this project. In `index.js`:

```js
const app = express();          // index.js:18
app.use(cors());                // index.js:19
app.use(express.json());        // index.js:20

app.get("/api/health", (req, res) => res.json({ status: "ok" })); // index.js:22
app.use("/api/auth", authRouter);  // index.js:23
app.use("/api/menu", menuRouter);  // index.js:24
```

`app.get(...)` at index.js:22 is Express reading "GET request to `/api/health`" and routing it straight to that one function — no manual URL parsing. `app.use("/api/auth", authRouter)` at index.js:23 mounts an entire *sub-router* (the one built in `auth.js` with `Router()` at auth.js:6) under a path prefix, which is why the actual routes registered as `authRouter.post("/register", ...)` (auth.js:8) and `authRouter.post("/login", ...)` (auth.js:24) end up reachable at `/api/auth/register` and `/api/auth/login`. That's Express composing small, focused route files instead of one giant switch statement.

`res.json({ status: "ok" })` (index.js:22) and `res.status(409).json({...})` (auth.js:15) are also pure Express — raw Node's `res` object has no `.json()`; you'd be manually calling `res.setHeader("Content-Type", "application/json")` and `res.end(JSON.stringify(...))` yourself, every time.

**Alternative and why this project chose Express:** Fastify and Koa are newer frameworks solving the same problem, generally with better raw throughput (Fastify) or a cleaner async model from the ground up (Koa, which predates widespread `async/await` support but was designed for it). Express is older, slightly slower under extreme load, and its middleware error-handling has some historical rough edges. This project picked it anyway because it's the most-documented, most-example-covered framework in the Node ecosystem — for a learning project, "there are a thousand answered Stack Overflow questions about this exact error" outweighs a performance edge you won't notice until you have real traffic.

## What "middleware" actually means

Plain English first: middleware is a checkpoint. Every request that comes into the server passes through a line of checkpoints before it reaches its final destination, and each checkpoint can inspect the request, modify it, reject it outright, or just wave it through to the next checkpoint. Airport security is a decent mental model — bag scan, then ID check, then gate — each step either lets you continue or stops you there.

Mechanically, an Express middleware is just a function with the signature `(req, res, next)`. Calling `next()` says "I'm done, pass this along to whoever's next in line." *Not* calling `next()` — and instead calling `res.status(...).json(...)` — means the chain stops right there and a response goes back immediately.

`requireAuth.js` is the clearest example of this in the project:

```js
export function requireAuth(req, res, next) {   // requireAuth.js:3
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: "Missing bearer token" }); // requireAuth.js:8 — chain stops here
  }

  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET); // requireAuth.js:12
    next();                                                 // requireAuth.js:13 — chain continues
  } catch {
    res.status(401).json({ error: "Invalid or expired token" }); // requireAuth.js:15 — chain stops here
  }
}
```

If there's no token, requireAuth.js:8 ends the chain right there with a 401 — the actual route handler behind it never even runs. If the token is valid, requireAuth.js:12 attaches the decoded payload onto `req.user` (so *every* function later in the chain can read `req.user.id` or `req.user.role` without re-verifying anything), and requireAuth.js:13 calls `next()` to let the request continue toward the real route.

That per-route (rather than global) attachment is exactly what `backend/src/routes/menu.js` does with `requireAuth`. `menu.js` splits menu endpoints along a read/write line — the file's own comment explains it — leaving `GET` routes open to anyone, but wrapping `requireAuth` directly into the route definition for anything that changes data: `menuRouter.post("/", requireAuth, ...)` (menu.js:13), `menuRouter.put("/:id", requireAuth, ...)` (menu.js:21), and `menuRouter.delete("/:id", requireAuth, ...)` (menu.js:27). Each of those lines runs `requireAuth` as one more argument in Express's handler chain before the actual route logic — the same three-argument `(req, res, next)` checkpoint as above, just attached to a single route instead of `app.use()`d for everything. It's the same middleware, mounted at a narrower scope.

`index.js` shows two more middleware, applied globally with `app.use` rather than on one route:
- `app.use(cors())` (index.js:19) — a checkpoint that adds the headers browsers require to allow cross-origin requests (e.g. your frontend on `localhost:5173` calling this API on `localhost:4000`). Every single request passes through it before anything else.
- `app.use(express.json())` (index.js:20) — a checkpoint that reads the raw request body stream and parses it into `req.body`. This is *why* `const { email, password } = req.body` works at auth.js:9 and auth.js:25 — without this middleware running first, `req.body` would be `undefined`.

The order at index.js:19–24 matters: `cors()` and `express.json()` run *before* the routes are mounted, because middleware executes in registration order — a route mounted before `express.json()` would never see a parsed body.

The error handler at index.js:26–29 is a special case: a middleware with **four** parameters (`err, req, res, next`) instead of three. Express recognizes that four-argument shape specifically as an error handler — but *how* an error actually gets routed there matters, and it's version-dependent. `backend/package.json` pins `"express": "^4.19.2"` — Express 4, not 5. Express 5 added automatic catching of errors thrown or rejected inside `async` route handlers; Express 4 did not. In this project, the error handler only runs when something earlier in the chain calls `next(err)` explicitly, or throws *synchronously* inside a regular (non-async) handler. A rejected Promise inside an `async` route handler will **not** reach it on its own.

That's not a theoretical gap — it's sitting in this exact codebase. Both `register` (auth.js:8) and `login` (auth.js:24) are `async` functions that call `bcrypt.hash`, `bcrypt.compare`, and `jwt.sign` with no `try/catch` and no manual `next(err)`. If any of those ever threw or rejected, the rejection would become an unhandled promise rejection instead of the clean 500 the handler at index.js:26 is meant to produce. Fixing that would mean either wrapping those route bodies in `try/catch` and calling `next(err)` from the `catch`, or upgrading to Express 5. It's still the last checkpoint when it *does* get reached — the "if everything else broke, send a generic 500 instead of leaking a stack trace" catch-all — but in an Express 4 app, something upstream has to actively route the error to it first.

**Alternative and why this project uses middleware this way:** you could skip the `requireAuth` abstraction entirely and paste the "check the header, verify the JWT" logic into every protected route by hand. That works for one route; it becomes an unmaintainable, easy-to-forget copy-paste job the moment you have five protected routes. Pulling it into one middleware function (`requireAuth.js`) that gets attached wherever it's needed is the standard Express pattern for cross-cutting concerns — auth, logging, rate-limiting — precisely because "checkpoint everyone passes through" is a better mental and code model than "duplicate the check everywhere."

## Self-check

1. In `bcrypt.compare(password, user.passwordHash)` at auth.js:28, what would happen to *other* users' requests if this call were synchronous and blocking instead of `await`ed?
2. Why does `app.use(express.json())` at index.js:20 have to be registered *before* `app.use("/api/auth", authRouter)` at index.js:23, given what you now know about middleware order?
3. In `requireAuth.js`, trace exactly what happens, line by line, when a request arrives with an expired JWT — which line ends the chain, and what does the client receive?
4. The error handler at index.js:26 takes four arguments instead of three. What's the practical result if you defined it with only `(req, res)` — would Express still treat it as an error handler?
5. `menu.js` already demonstrates this pattern: `requireAuth` is wrapped around the write routes (`menuRouter.post`, menu.js:13; `.put`, menu.js:21; `.delete`, menu.js:27) but left off the `GET` routes. Walk through *why* that specific split — open reads, protected writes — makes sense for a menu endpoint. Then: if you needed to add one more protected route to `menuRouter`, what's the exact line you'd add, and where would it go relative to the route path?

## My notes

## Things I found hard (ask for a deeper explanation)