# Authentication & Security Concepts

## Why passwords are hashed, not stored

Plain-English first: if you store a password as-is and your database ever leaks, every user's real password leaks with it — and because people reuse passwords, that one leak becomes a skeleton key for their email, their bank, everything else. So instead of storing the password, you store a fingerprint of it. A fingerprint that's easy to check but practically impossible to reverse back into the original.

That's what `backend/src/routes/auth.js:18` is doing:

```js
const passwordHash = await bcrypt.hash(password, 10);
```

Technical precision now. `bcrypt.hash` doesn't just run the password through a hash function once — it runs a purpose-built algorithm (bcrypt, based on the Blowfish cipher) that's *deliberately slow*. The `10` is the "cost factor" — it tells bcrypt to do 2^10 rounds of internal key expansion. A generic hash like SHA-256 is built for speed (that's good for checksums, bad for passwords) — an attacker with a leaked SHA-256 hash list can try billions of guesses per second on a GPU. bcrypt is built to be slow on purpose, so the same attacker might only manage thousands of guesses per second. That difference is the entire point.

**Salting** is baked directly into bcrypt's output — you won't see a separate salt variable anywhere in `auth.js` because bcrypt generates a random salt internally and stores it as part of the returned hash string (that's why bcrypt hashes always start with something like `$2a$10$...` — the `10` there is the cost, followed by the embedded salt, followed by the hash itself). Without a salt, two users with the same password ("password123") would produce identical hashes, and an attacker could precompute a giant lookup table (a "rainbow table") of common password → hash pairs once and crack every user who shares a password. A random salt per user means every hash is unique even for identical passwords, so precomputed tables are useless.

**Why one-way matters:** hashing is not encryption. Encryption is reversible (there's a key that decrypts it) — hashing has no decryption key at all, mathematically. That's deliberate: nobody, not even Avian, not even a rogue engineer with full database access, should be able to look at `user.passwordHash` and recover the original password. This is why login doesn't "decrypt and compare" — it re-hashes the guess and compares hashes. That's exactly what happens at `auth.js:28`:

```js
const passwordMatches = user && (await bcrypt.compare(password, user.passwordHash));
```

`bcrypt.compare` pulls the salt back out of the stored hash, re-runs the same slow algorithm on the submitted password with that salt, and checks if the result matches. The original password is never stored, never recoverable, and never needs to be.

## What a JWT actually is

Plain-English first: a JWT ("JSON Web Token") is a self-contained, tamper-evident ID badge. Instead of the server keeping a list of "who's currently logged in" in a database, the server hands the *user's browser* a signed badge, and the user shows that badge on every request. The server just checks the signature is valid — it doesn't need to look anything up.

Structurally, a JWT is three base64url-encoded pieces joined by dots: `header.payload.signature`.

- **Header** — metadata, typically `{ "alg": "HS256", "typ": "JWT" }`, saying which signing algorithm was used.
- **Payload** — the actual claims. In this project, that's built at `auth.js:34`: `{ sub: user.id, email: user.email, role: user.role }`, plus an expiry claim added automatically by the `expiresIn: "8h"` option at `auth.js:36`.
- **Signature** — a cryptographic signature over the header+payload, computed using `process.env.JWT_SECRET` (`auth.js:35`). This is the part that makes it tamper-evident.

Important nuance: the header and payload are **encoded, not encrypted**. Anyone can paste a JWT into a decoder and read `sub`, `email`, and `role` in plain text — that's why the payload here only carries an id, email, and role, nothing sensitive like a password or payment info. The signature doesn't hide the contents; it proves the contents weren't altered after the server issued them. If someone tampers with the payload (say, changing `role: "customer"` to `role: "admin"`), the signature no longer matches, and verification fails.

That verification happens in `backend/src/middleware/requireAuth.js:12`:

```js
req.user = jwt.verify(token, process.env.JWT_SECRET);
```

`jwt.verify` recomputes the signature using the same secret and checks it matches what's embedded in the token, and it also checks the expiry claim automatically — an expired token throws, which is caught at `requireAuth.js:14` and turned into a 401.

**This is what "stateless" means in practice**: there's no `sessions` table, no server-side store of "which tokens are currently valid" anywhere in this codebase. `requireAuth.js` does zero database lookups — it verifies the signature and moves on (`next()` at line 13). The entire authorization decision is made from data the client handed you, cryptographically proven not to have been altered since the server signed it.

## Bearer token — what the word means

"Bearer" is a specific, old term from OAuth's spec: it means *whoever holds (bears) this token gets the access it grants* — no additional proof of identity required. Not "the token bound to this specific device," not "the token plus a password" — just possession. That's why it's sent in the `Authorization` header as literally `Bearer <token>`, and why `requireAuth.js:5` parses it that bluntly:

```js
const token = header.startsWith("Bearer ") ? header.slice(7) : null;
```

The security implication is direct: if a bearer token is stolen — copied out of browser storage, sniffed off an unencrypted connection, leaked in a log — the thief *is* the user, fully, until the token expires. There's no second factor checked here. `expiresIn: "8h"` (`auth.js:36`) bounds the *maximum* damage window, but does nothing during that window. This is exactly why sensitive systems pair JWTs with HTTPS-only transport, short expiries, and often store the token in an `httpOnly` cookie rather than `localStorage` — specifically so client-side JavaScript (and therefore XSS payloads) can't read it at all.

## JWT vs cookie-based sessions vs OAuth — real tradeoffs

These solve overlapping problems differently. None is "correct" in the abstract — each fits a different shape of system.

**Cookie-based sessions (the classic approach):** server generates a random session ID, stores `{ sessionId: userData }` in a database or in-memory store (Redis, etc.), and sends the browser only the opaque ID as a cookie. The browser automatically attaches it to every request. Advantage: the server can instantly kill a session — delete the row, and the user is logged out everywhere, immediately. Disadvantage: every authenticated request needs a database or cache lookup to resolve the session ID into user data, and it doesn't naturally cross domains (a mobile app or a third-party API consumer can't rely on cookie auto-attachment the way a browser does).

**JWT (what this project uses):** no server-side lookup needed — the token carries its own proof. This is *why* it fits `requireAuth.js` well here: this is a small backend where avoiding an extra DB round-trip per request, and avoiding a session-store dependency (Redis, etc.) entirely, is a real simplicity win for a lab-scale SaaS project. The cost is the flip side of the cookie approach's advantage, and it's the single sharpest tradeoff in this whole design: **you cannot revoke a JWT early.** There is no list of valid tokens anywhere in this codebase to delete a row from — `requireAuth.js` never touches a database — so a token stays cryptographically valid, and therefore usable, until its `exp` claim naturally passes, no matter what happens to the account in the meantime. Cookie-sessions don't have this problem; JWTs trade it away for statelessness.

**OAuth:** a different problem entirely — OAuth isn't primarily "how do I authenticate my own users," it's "how do I let a *third-party* app get *delegated, scoped* access to a resource, often on another provider's behalf" — e.g. "let this app read your Google Calendar without ever handing it your Google password." (Strictly, OAuth 2.0 itself is an authorization framework; the familiar "Sign in with Google" *login* experience is OpenID Connect, a thin identity layer built on top of OAuth — the two get conflated constantly because OIDC reuses OAuth's redirect flow.) OAuth issues tokens (often JWTs, sometimes opaque tokens) scoped to specific permissions, via a redirect flow to an identity provider and back. This project doesn't have that shape of problem — there's no third-party provider, no delegated scope, just "is this the account owner." OAuth here would be solving a problem this project doesn't have — that's *why* it's absent, not an oversight.

The concrete choice actually made in this codebase: register with bcrypt-hashed passwords (`auth.js:18`), authenticate by issuing a self-signed, stateless JWT with an 8-hour expiry (`auth.js:33-37`), and authorize subsequent requests purely by verifying that signature (`requireAuth.js:11-13`) — no session store, no OAuth redirect dance. That's the right-sized choice for a single first-party app with its own login form, at the cost of the revocation problem above.

## Realistic failure modes

**Stolen tokens.** Covered above under Bearer tokens: possession is everything, and the usual mitigations (HTTPS-only transport, short expiries, `httpOnly` cookie storage instead of `localStorage`) are what keep the exposure window small rather than eliminate it.

**The revocation problem.** Also covered above: there's no way to kill a JWT before it expires in this codebase. The usual real-world mitigations — none of which exist here yet, worth noticing as a gap — are: a server-side denylist of revoked token IDs (which quietly reintroduces the "look something up on every request" cost JWTs were meant to avoid), short-lived access tokens paired with a separate revocable refresh token, or just accepting the exposure window and keeping `expiresIn` short.

## Self-check

1. Why does `bcrypt.compare` (`auth.js:28`) re-hash the submitted password instead of decrypting the stored hash to compare it directly?
2. If you decoded the JWT this project issues and read its payload, what could you learn about a user without ever knowing `JWT_SECRET`? What could you *not* do without knowing it?
3. `requireAuth.js` never queries the database. What specific capability does that cost the app, and what does it gain in exchange?
4. Why does the `role` claim live inside the signed payload (`auth.js:34`) rather than being looked up fresh from the database on every request — and what would go wrong if a user's role changed mid-session?
5. If this project later added "Sign in with Google," what would that actually require (OAuth, OIDC, or both), and what would it be solving that the current `bcrypt` + JWT setup doesn't?

## My notes

## Things I found hard (ask for a deeper explanation)