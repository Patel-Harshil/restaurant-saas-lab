# JavaScript Async: Promises, async/await, and fetch

## The single-threaded puzzle

JavaScript runs your code on one thread. One line finishes before the next starts — no two lines of *your* code ever run at the exact same instant. So how does `restaurant-saas-lab` handle a login request without freezing the whole app while it waits for the database, or waits for `bcrypt` to grind through a password hash?

The trick: JavaScript doesn't do the *waiting* itself. When your code hits something slow — a network call, a disk read, a timer — it hands that work off to the runtime (the browser's engine, or Node's libuv thread pool) and immediately moves on to other code. When the slow thing finishes, the runtime drops the result into a queue, and JavaScript picks it up *later*, once its single thread is free. That's the event loop. Your code never blocks; it just gets interrupted-and-resumed in an orderly way.

This matters concretely in this project. Look at `backend/src/routes/auth.js:8`:

```js
authRouter.post("/register", async (req, res) => {
```

While one request is waiting on `bcrypt.hash` (line 18) — which is deliberately slow, that's the whole point of a password hash — the Node process is completely free to accept *other* incoming requests on other routes. If Node blocked the thread for the ~100ms a bcrypt hash takes, every other customer hitting the menu API at the same moment would just sit there queued behind it. Non-blocking I/O is why one Node process can serve many users at once despite being single-threaded.

## What a Promise actually is

Plain English first: a Promise is a receipt. You hand off a slow task, and instead of getting the result immediately, you get a receipt that says "come back later and I'll either have your thing, or an explanation of why it failed." The receipt itself is a real JavaScript object you can hold, pass around, and attach callbacks to — right now, even though the actual answer doesn't exist yet.

Technically: a Promise is an object representing the eventual result of an asynchronous operation. It exists in exactly one of three states:

- **pending** — the operation hasn't finished yet
- **fulfilled** — it finished successfully, and the promise now holds a value
- **rejected** — it finished with an error, and the promise now holds a reason

Crucially, a promise can only transition *once*: pending → fulfilled, or pending → rejected. Never back, never twice. That guarantee is what makes `.then()`/`.catch()` chains — and `await` — reliable.

`fetch(...)` on `frontend/src/api.js:4` returns exactly this kind of object the instant it's called — before a single byte has come back from the server. The `fetch` call itself resolves (fulfills) as soon as HTTP *headers* arrive, not the full body — that's why line 15 does a second, separate await on `.json()`, because parsing/streaming the body is itself another asynchronous step with its own promise.

## async/await is sugar over Promises

Here's the thing that trips people up: `async`/`await` doesn't replace Promises, it's just a nicer way to *read* them. Under the hood, every `async` function still returns a Promise, and every `await` is still just "attach a callback to this promise and pause here until it settles."

Compare the two ways of writing the same idea. What `frontend/src/api.js:3-4` actually does:

```js
async function request(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${BASE_URL}${path}`, { ... });
```

is functionally identical to writing:

```js
function request(path, opts) {
  return fetch(`${BASE_URL}${path}`, { ... }).then(res => { ... });
}
```

`await` just lets you write the second version so it *reads* top-to-bottom like synchronous code, without the nested `.then()` chains. That's the entire value proposition — same underlying mechanism, easier for a human to follow, especially once you're chaining more than one async step, which `request()` does three times in a row: fetch (line 4), then conditionally the JSON parse (line 15), then the caller awaits `request()` itself.

**Why `await` only works inside `async` functions**: `await` pauses execution of the *current function* until the promise settles, and hands control back to the caller in the meantime. That pausing mechanism is literally what `async` sets up when the function is defined — it's what makes the function itself return a Promise instead of a plain value. There's no way to "pause a plain function" that regular code is calling and expecting a synchronous return from; that would break every non-async caller of it. This is why `request()` on line 3 has to be declared `async function request(...)` before it's allowed to use `await fetch(...)` on line 4, and why both route handlers in `auth.js` are declared `async (req, res) => { ... }` (lines 8 and 24) before they're allowed to `await bcrypt.hash` / `await bcrypt.compare` inside them.

## The exact same pattern, frontend and backend

This is the part worth sitting with: `await somethingSlow()` looks *identical* whether the slow thing is a network round-trip in the browser or a CPU-bound hash on the server. The language doesn't care what's on the other side of the promise.

- **Frontend, network I/O:** `frontend/src/api.js:4` — `const res = await fetch(...)`. Slow because of network latency: DNS, TCP, the server actually processing the request, the response traveling back.
- **Backend, CPU-bound work:** `backend/src/routes/auth.js:18` — `const passwordHash = await bcrypt.hash(password, 10)`. Slow *on purpose* — bcrypt's whole security value is that it's deliberately expensive to compute, so brute-forcing a leaked hash is expensive too. Same on line 28: `await bcrypt.compare(password, user.passwordHash)`.

Same keyword, same mental model — "pause here, let other work happen, resume when it's ready" — for two completely different kinds of "slow."

**Now the interesting exception, because it's a real tradeoff worth understanding, not a rule without exceptions**: look at `backend/src/routes/auth.js:33-37`:

```js
const token = jwt.sign(
  { sub: user.id, email: user.email, role: user.role },
  process.env.JWT_SECRET,
  { expiresIn: "8h" }
);
```

No `await`. That's not a bug — `jsonwebtoken`'s `.sign()` supports two call styles: pass a callback and it runs asynchronously (useful for algorithms like RS256 that do async key lookups); omit the callback, like this project does, and it runs **synchronously**, returning the signed string directly. Signing a JWT with HS256 (a shared secret, which is what `process.env.JWT_SECRET` implies here) is fast, in-memory, CPU-only work — there's no I/O to wait on, so there's nothing here that benefits from being async. Making it `await`-able anyway would add overhead (a microtask tick) for zero benefit. This is a good instinct to build: not everything that *touches* crypto needs to be a promise — only reach for async when there's actual I/O or intentionally-expensive work being handed off, which is exactly why `bcrypt.hash`/`bcrypt.compare` *are* async here and `jwt.sign` isn't.

## Alternatives this project didn't take, and why

- **Callbacks instead of Promises.** Node's older APIs (and the original `bcrypt`/`jsonwebtoken` designs) used `fn(args, (err, result) => {...})`. This project uses `bcryptjs` and calls it in `await`-style, meaning it's using the promise-returning overload, not the callback one — because callback chains for multiple sequential steps (hash password → look up user → sign token) get unreadable fast ("callback hell"), and error handling has to be repeated at every level instead of falling through to one `try/catch` or, as `api.js:15` does, a single `.catch()`.
- **`.then()/.catch()` chains instead of `await`.** Technically equivalent (see above), but `request()` in `api.js` does two sequential awaits (line 4, line 15) plus a conditional early return (line 13) — expressing that as nested `.then()` calls is possible but noticeably harder to scan than the current linear version.
- **A synchronous hashing library.** Node has `crypto.scryptSync`, which blocks the thread until done. Using it in `register`/`login` would freeze the *entire server* — every other in-flight request — for the duration of every hash. `bcrypt`'s async API (line 18, line 28) is the correct choice specifically because auth endpoints get hit by every user and must not create a serialization bottleneck.
- **XMLHttpRequest instead of `fetch`.** `fetch` (line 4) is promise-native by design; `XMLHttpRequest` is callback/event-based and would need manual wrapping in a `new Promise(...)` to fit into this same `async function request()` shape at all.

## Self-check

1. If `fetch` on `api.js:4` resolves as soon as HTTP headers arrive, what is `res` at that point — has the response body been read yet? What does line 15 tell you about that?
2. Why does `authRouter.post("/register", async (req, res) => {...})` on `auth.js:8` need the `async` keyword at all, given that `res.status(400).json(...)` on line 12 is called with no `await`?
3. `jwt.sign` on `auth.js:33` isn't awaited. If someone "fixed" it by adding `await` in front, would the code break? Would it behave any differently at all?
4. A Promise can go pending → fulfilled or pending → rejected, but never fulfilled → rejected. Why does that one-way-only guarantee matter for something like `request()` in `api.js`, which is awaited by every function in the `api` object (lines 23-29)?
5. What would you have to change in `request()` (`api.js:3-20`) if `bcrypt.hash` were swapped for a synchronous alternative on the backend — would anything on the frontend need to change too?

## My notes

## Things I found hard (ask for a deeper explanation)