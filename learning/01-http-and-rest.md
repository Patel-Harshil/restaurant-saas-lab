# HTTP & REST Fundamentals

## What HTTP actually is

Strip away the acronym and HTTP is just an agreed-upon shape for a conversation between two programs: one asks a question ("give me the menu," "add this item"), the other answers. That's it. It's a *protocol* — a shared set of rules about how to phrase the ask and the answer — not a piece of software you install and not a specific product. Your browser speaks it, `fetch()` speaks it, Express speaks it, curl speaks it. Because everyone agrees on the same rules, a JavaScript frontend you wrote can talk to a Node backend you also wrote without either side needing to know anything special about the other's internals.

You can see this literally in your own project. `frontend/src/api.js:4` builds a URL and hands it to the browser's built-in `fetch()`. `backend/src/index.js:18-24` builds an Express `app` that listens for exactly that kind of request and decides what to send back. Neither file imports the other. The only thing connecting them is that both sides agree on HTTP's rules — the URL, the method, the headers, the body format. That agreement *is* the API.

## The request/response cycle

Plain English: the client sends one message, the server sends back exactly one message, and then the connection's business is done (a new request starts the cycle over — nothing is "remembered" in between unless you deliberately build that in).

Now the technical shape, using your actual code. Every request your frontend makes funnels through one function, `request()` in `frontend/src/api.js:3-20`:

- **Line 4**: `fetch(\`${BASE_URL}${path}\`, ...)` — this is the request going out. `BASE_URL` (line 1, pulled from `import.meta.env.VITE_API_URL`) plus a `path` like `/api/menu` becomes the full address.
- **Line 5**: `method` — which *kind* of request this is (more on this below).
- **Lines 6-9**: `headers` — metadata about the request, sent alongside it but separate from the actual content.
- **Line 10**: `body` — the actual payload, only present when there's data to send (a `POST` or `PUT`).
- **Line 4-11 as a whole** is the *request*. Somewhere on the other end, Express receives it, a route handler runs, and it sends back a *response* — a status code, its own headers, and (usually) a JSON body.
- **Lines 13-19** are your frontend handling that response: checking the status, parsing the body, deciding whether to treat it as success or failure.

One request out, one response back, cycle closed. `backend/src/index.js:22` — `app.get("/api/health", (req, res) => res.json({ status: "ok" }))` — is the smallest possible example of this: request comes in, `res.json(...)` sends the response, done. Notice the handler takes both `req` (the incoming request) and `res` (the tool for building the outgoing response) as separate objects — that separation *is* the request/response cycle made concrete in code.

## The verbs, and why each one fits a specific purpose

Plain English: the verb (method) is you telling the server *what kind of thing you're trying to do* before it even looks at the details — "I'm reading," "I'm creating," "I'm replacing," "I'm deleting." The server (and anyone reading your code later, including future-you) can reason about safety and side effects from the verb alone, without reading the handler body.

Your project's `api` object (`frontend/src/api.js:22-30`) is a clean map of this in practice:

- **`GET`** — `listMenu: () => request("/api/menu")` (line 26). No method specified, so it defaults to `"GET"` (line 3). GET means "give me data, and don't change anything on the server while you're at it." That's why `menuRouter.get("/", ...)` in `backend/src/routes/menu.js:8` requires no auth at all — reading is safe, side-effect-free, and the code comment above it spells that out: *"Reading the menu is public — a diner doesn't need an account to see it."* (line 7).
- **`POST`** — `createMenuItem: (token, item) => request("/api/menu", { method: "POST", ... })` (line 27). POST means "create something new." Correspondingly, `menuRouter.post("/", requireAuth, ...)` in `menu.js:13` runs validation (lines 15-17) and, on success, responds with `res.status(201).json(createMenuItem({...}))` (line 18) — a brand-new resource was made.
- **`PUT`** — `updateMenuItem: (token, id, patch) => request(\`/api/menu/${id}\`, { method: "PUT", ... })` (line 28). PUT targets one specific existing resource by ID and updates it: `menuRouter.put("/:id", requireAuth, ...)` (menu.js:21).
- **`DELETE`** — `deleteMenuItem: (token, id) => request(\`/api/menu/${id}\`, { method: "DELETE", token })` (line 29), matched by `menuRouter.delete("/:id", requireAuth, ...)` (menu.js:27).

Why not just have one endpoint that takes an `"action": "create"` field in the body and figure it out server-side? You *could* — that's actually how a lot of RPC-style APIs work. But then every client, every proxy, every logging tool has to open the body to know what's happening. With verbs, `GET` requests can be cached and safely retried by browsers and CDNs without anyone reading a byte of payload, and a security review can grep for `.post(`/`.put(`/`.delete(` in `menu.js` and immediately see every place the project can mutate data — which is exactly why `requireAuth` shows up on lines 13, 21, and 27 but conspicuously not on line 8.

One honest wrinkle worth noticing: `updateMenuItem` (api.js:28) calls its argument `patch` and only sends the fields that changed, but the method is `PUT`, not `PATCH`. Strict REST convention says `PUT` means "replace the whole resource" and `PATCH` means "apply a partial update." This project uses `PUT` for what is really a partial update — a common, pragmatic shortcut in small APIs, but worth knowing you're bending the convention, not following it exactly.

## Status codes

Plain English: the status code is the one-word verdict at the top of the response — "yes," "yes, and here's something new," "no, you asked wrong," "no, that doesn't exist," "no, I broke." Everything else in the response is detail; the status code is the headline your code should branch on first.

Your files exercise a small, honest set of them:

- **200** — the implicit default for a successful `res.json(...)` with no explicit status, e.g. `menu.js:9` and `index.js:22`.
- **201 Created** — `menu.js:18`, explicitly set because a *new* resource now exists. This is the "yes, and" status — success, plus "here's the thing you made."
- **400 Bad Request** — `menu.js:16`, returned when `name` is missing or `price` isn't a valid non-negative number (line 15). This is "your request itself was malformed" — the server never even got to try the operation.
- **404 Not Found** — `menu.js:23` and `menu.js:29`, when `updateMenuItem`/`deleteMenuItem` can't find that ID. The request was well-formed; the target just doesn't exist.
- **204 No Content** — `menu.js:30`, after a successful delete. There's nothing left to send back describing the deleted thing, so the body is empty on purpose. Your frontend explicitly special-cases this: `api.js:13` — `if (res.status === 204) return null;` — because calling `.json()` on an empty body would throw.
- **500 Internal Server Error** — the catch-all error middleware in `index.js:26-29`. Notice it logs the real error (`console.error(err)`, line 27) but sends the client a generic `"Internal server error"` (line 28) rather than the actual exception message or stack trace — that's a deliberate leak-prevention choice, not laziness.

The client side treats the whole numeric range as one binary signal: `api.js:16` checks `!res.ok` — `res.ok` is `fetch`'s own shorthand for "status is in the 200-299 range" — and if it's false, throws using whatever error message the server provided (`data?.error`, line 17) or a generic fallback. This is a good pattern to notice: the frontend doesn't hand-check `if (status === 404) ... else if (status === 400) ...` everywhere; it centralizes "was this successful at all" in one place (`request()`) and lets each specific status's *meaning* live in the error message instead.

## Headers

Plain English: headers are the sticky notes attached to the envelope, not the letter inside it — metadata about the request or response that both sides need before (or without) reading the body.

Concrete examples from your code:

- **`Content-Type: application/json`** (`api.js:7`) — the frontend telling the server "the body I'm sending is JSON, parse it that way." This only matters, and only gets read, because `backend/src/index.js:20` has `app.use(express.json())` — Express middleware that specifically looks for that header and parses the body accordingly. Take that line out and `req.body` in `menu.js:14` would be `undefined` no matter what the client sent.
- **`Authorization: Bearer ${token}`** (`api.js:8`, added conditionally with `...(token ? {...} : {})`) — this is how the client proves who it is, rather than a server-side session — more on why that matters in REST below.
- **CORS headers** — `index.js:19`, `app.use(cors())`. Your frontend and backend run on different origins during development (different ports), and browsers block cross-origin requests by default unless the *response* carries headers explicitly permitting it. This one line is entirely about headers you never see directly — it makes Express attach the `Access-Control-Allow-Origin` family of headers automatically.

## What "REST" actually means

Plain English: REST isn't a technology you install or a library you import — it's a *style of agreement* about how to design URLs and use HTTP verbs so that anyone (including future-you) can guess how the API works without reading a manual. "Resources" (nouns, like a menu item) live at URLs; verbs describe what you're doing to them.

You can see the convention directly:

- **Resources are nouns in the URL, not verbs.** `/api/menu` (menu.js, router mounted at `index.js:24`) is "the collection of menu items," and `/api/menu/:id` (`menu.js:21`, `27`) is "one specific menu item." Nothing is named `/api/getMenu` or `/api/deleteMenuItem` — the *verb* comes from the HTTP method, not the URL path. That symmetry is the whole idea: same URL, different method, different meaning (line 8 GET vs. line 13 POST both target `/`).
- **Statelessness.** Nothing on the server remembers "who's logged in" between requests. Every write proves identity fresh, via the `Authorization` header (`api.js:8`) checked by `requireAuth` on every protected route (`menu.js:13,21,27`). Contrast this with old-school server-side sessions, where the server keeps an in-memory table of "session ID → logged-in user" and the client just carries a session cookie. Sessions can feel simpler for a single server, but they don't scale horizontally without shared session storage, and they don't map cleanly onto a case where the "client" isn't a browser at all (a mobile app, another service). This project's choice — stateless bearer tokens — is the more RESTful one and is why nothing in `index.js` sets up session middleware.
- **Uniform interface.** Every resource in this API is manipulated with the same small verb vocabulary (GET/POST/PUT/DELETE) rather than each route inventing its own custom operation names. That's a convention, enforced by the developers' discipline, not by anything Express forces on you — Express would happily let you build `/api/menu/doTheThing` if you wrote that route.

**The realistic alternative worth naming: GraphQL.** Instead of multiple REST endpoints returning fixed shapes, GraphQL exposes a *single* endpoint where the client specifies exactly which fields it wants in one query, across whatever resources it needs, in one round trip. For a small CRUD app like this one — one resource (menu items), simple relationships, a handful of routes — REST's directness (a URL and a verb map straight onto a database operation) is easier to build, easier to secure per-route (`requireAuth` sitting cleanly on three specific route lines), and easier to reason about. GraphQL earns its complexity when the client needs to combine many related resources flexibly or when over-fetching/under-fetching becomes a real cost — neither is true here yet. If this app later grows a dashboard that needs orders, menu items, and staff data stitched together in custom shapes per screen, that's the moment GraphQL's tradeoff would start to look different.

## Self-check

1. In `api.js:3-20`, why does `request()` check `res.status === 204` *before* trying to parse JSON, and what would break if that check were removed?
2. `menu.js:8` requires no auth but `menu.js:13`, `21`, and `27` all do. Walk through *why*, in terms of what GET vs. POST/PUT/DELETE each promise about side effects.
3. If you changed `menuRouter.put("/:id", ...)` (`menu.js:21`) to `menuRouter.patch("/:id", ...)`, what else in `api.js:28` would need to change, and would the behavior of the handler itself need to change too?
4. Why does the error handler in `index.js:26-29` log the full error server-side but only send `"Internal server error"` to the client? What's the risk if it sent `err.message` or `err.stack` instead?
5. The `Authorization` header carries a Bearer token instead of the server keeping a session. Name one concrete situation where a session-cookie approach would have been simpler, and one where it would have caused a real problem this project avoided.

## My notes

## Things I found hard (ask for a deeper explanation)