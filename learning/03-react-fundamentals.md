# React Fundamentals

You read finished code on Day 1. That's like being handed a completed crossword and being told "see, that's how crosswords work." This chapter is the pass you didn't get: what each piece *is*, why it exists, and what would happen if it weren't there. Every example below is real code from your project — no invented snippets.

## What a component actually is

Strip away the jargon: a component is **a JavaScript function that returns a description of some UI**. Not the UI itself — a *description* of it, which React then turns into real DOM elements. That's the whole idea. Nothing more mystical is happening.

Look at `App.jsx:8`:

```jsx
function App() {
```

That's it. `App` is a function. It happens to return something that looks like HTML (`App.jsx:22-43`), but it's still just a function — you call it, it runs top to bottom, and it returns a value. React calls this function for you and takes the return value as instructions for what to draw on screen.

Your project has three components: `App` (`App.jsx:8`), `AuthPanel` (`AuthPanel.jsx:4`, `export function AuthPanel({ onAuthenticated })`), and `MenuManager` (`MenuManager.jsx:4`, `export function MenuManager({ token })`). Each is a self-contained unit: it owns its own local variables (via `useState`, more below), it can be handed data from outside (via arguments — "props"), and it produces markup. `App` then *composes* the other two — it calls them like tags inside its own return value:

```jsx
<MenuManager token={session?.token} />          // App.jsx:37
<AuthPanel onAuthenticated={(token, user) => setSession({ token, user })} />  // App.jsx:39
```

**Alternative that was rejected:** you could build this whole app with plain DOM manipulation — `document.createElement`, `.appendChild`, manually updating text nodes when data changes. That's exactly what pre-React jQuery-style apps did, and it's exactly why React exists: once you have more than a couple of pieces of state affecting the DOM, hand-tracking "what needs to re-render when X changes" becomes the majority of your bugs. React's whole pitch is: **describe what the UI should look like for a given state, and let the library figure out the DOM diff.** You write `App.jsx:26-33`; you never write "now go find the `<span>` and change its text."

## JSX, and exactly how it differs from HTML

Plain-English first: JSX *looks* like HTML sitting inside JavaScript, but it isn't HTML — it's a shorthand that gets compiled into JavaScript function calls before your browser ever sees it. That compile step is the whole reason it's allowed to bend HTML's rules.

Concretely, look at `App.jsx:23`:

```jsx
<div className="app-shell">
```

Not `class="app-shell"`. In real HTML, `class` is the attribute name. In JSX, `class` is a **reserved word in JavaScript** (from the `class` keyword used to define classes), so JSX had to pick a different name for the same concept — `className`. You'll see this consistently: `MenuManager.jsx:57` — `className={item.available ? "" : "unavailable"}`. That's JSX computing the class name from a JavaScript expression at render time, which plain HTML attributes flatly cannot do — HTML attributes are static strings, full stop.

The curly braces are the single most important thing to understand about JSX: **anything inside `{}` is a JavaScript expression, evaluated and dropped into the output.** `App.jsx:28`:

```jsx
<span>Signed in as {session.user.email}</span>
```

`session.user.email` isn't a string in the markup — it's read from your component's variables at render time. This is why JSX is not a templating language like Handlebars or EJS: there's no separate mini-language for loops/conditionals with its own syntax (`{{#if}}`, `{{#each}}`). You just write real JavaScript inside braces — that's why you see `.map()` for lists (`MenuManager.jsx:56`) and ternaries for conditionals (`App.jsx:26-33`) instead of special JSX-only directives.

Event handlers are also not HTML attributes — `App.jsx:29`:

```jsx
<button type="button" onClick={() => setSession(null)}>Log out</button>
```

In real HTML, `onclick="doSomething()"` takes a *string* that gets `eval`'d. In JSX, `onClick` takes an actual JavaScript function reference — here an arrow function closing over `setSession`. No string, no eval, no separate lookup — just a function value, camelCased (`onClick`, not `onclick`; `onChange`, not `onchange` — see `AuthPanel.jsx:33`).

One structural rule HTML doesn't have: a component can only return *one value*, so JSX requires a single root node — but "one root node" doesn't have to mean an extra wrapping DOM element. `App`'s return does use a real wrapping element, `<div className="app-shell">` (`App.jsx:23`), around everything — but that's a styling choice, not a requirement of the rule. React Fragments (`<>...</>`) let a component return several sibling elements as that one JS value, with **zero** extra DOM node added. You're already looking at this in your own project: `MenuManager.jsx:62` and `:69` wrap the two per-item buttons in `<>...</>` rather than a `<div>`, specifically so no stray wrapper element gets inserted into the `<li>` around them. So the accurate version of the rule is "one value out," not "one wrapping HTML element out" — a raw HTML page can have five sibling `<div>`s directly in `<body>` with nothing wrapping them; a JSX return can't do that *without* either a real wrapping element or a Fragment standing in for one.

**Alternative that was rejected:** you could skip JSX's angle-bracket syntax and call the underlying function directly, no compile step needed. That's essentially what JSX *becomes* under the hood. Specifically for this project: React 19 with `@vitejs/plugin-react` uses the **automatic JSX runtime** by default, so each JSX element compiles to a call like `jsx('div', { className: 'app-shell', ... })`, imported automatically from `react/jsx-runtime` — you never write that import yourself, Vite's transform inserts it. (Older React versions and tooling, or a `classic` runtime setting, compiled JSX to `React.createElement(...)` instead — you'll still see that form in a lot of tutorials and older codebases, but it isn't what this project's Vite build actually produces.) Nobody writes either form by hand once nesting gets a few levels deep, because it's unreadable — JSX exists purely as ergonomic sugar over these calls, not as a new capability.

## Props vs. state — why the distinction is load-bearing

Plain English: **props are what a component is *told*; state is what a component *remembers*.** Props come from outside and the component doesn't get to change them. State lives inside the component and the component controls it directly.

This isn't a style preference — it's the mechanism React uses to know when to re-render. If you can't tell props from state, you can't reason about *why* your screen ever updates.

Props, concretely: `AuthPanel` declares its props right in the function signature — `AuthPanel.jsx:4`:

```jsx
export function AuthPanel({ onAuthenticated }) {
```

`onAuthenticated` is a prop — a function handed down from the parent. `AuthPanel` never defines what it does, only *when* to call it (`AuthPanel.jsx:20`, after a successful login). Same with `MenuManager.jsx:4`, `token` is a prop. `MenuManager` doesn't decide what the token is or where it came from — it's handed one (or `undefined`) by whoever renders it: `App.jsx:37`, `<MenuManager token={session?.token} />`. If `MenuManager` tried to reassign `token` itself, that would be fighting the model — props are read-only from the receiving component's point of view. The only way `token` changes is if `App` re-renders `MenuManager` with a different value, which happens when `App`'s own state (`session`) changes.

State, concretely: `App.jsx:9`, `const [session, setSession] = useState(...)`. `App` owns this. Nobody hands `App` its session — `App` decides it, remembers it, and changes it via `setSession`. `AuthPanel` owns five pieces of local state that nothing outside it cares about — `mode`, `email`, `password`, `error`, `submitting` (`AuthPanel.jsx:5-9`). None of that belongs in `App`; it's UI detail of the login form itself, irrelevant to anyone else.

Why the distinction matters in practice: notice `App.jsx:39`:

```jsx
<AuthPanel onAuthenticated={(token, user) => setSession({ token, user })} />
```

`AuthPanel` doesn't have access to `setSession` — it can't reach into `App` and mutate its state directly (there is no mechanism for that in React; a child can never write to a parent's variables). Instead `App` hands `AuthPanel` a *callback* as a prop. When `AuthPanel` finishes logging in (`AuthPanel.jsx:19-20`), it calls `onAuthenticated(token, user)` — which, because of how `App` defined that prop, actually runs `setSession({ token, user })` back up in `App`. This pattern is called **lifting state up**: the state lives in the lowest common parent of everything that needs it (here, `App`, since both the header and `MenuManager` need to know whether you're logged in), and children get either the data (as a prop) or a way to request a change (a callback prop) — never direct write access.

**Alternative that was rejected:** for an app this size, you *could* reach for React Context or a state library (Redux, Zustand, Jotai) to avoid passing `token` and `onAuthenticated` by hand. That solves "prop drilling" — passing a prop down through five layers of components that don't care about it, just to reach a sixth that does. Here the tree is only one level deep (`App` → `AuthPanel`/`MenuManager`), so plain props are strictly simpler and there's nothing to drill through. Reaching for Context/Redux here would be solving a problem this app doesn't have yet — add it when a third or fourth sibling component needs the same session data and passing it by hand actually gets awkward.

## `useState`

Plain English: `useState` gives a component a piece of memory that survives between renders, plus a function to update it. Call `setSomething`, and React re-runs the component function with the new value in hand.

The shape is always `const [value, setValue] = useState(initialValue)`. You see this five times in `AuthPanel.jsx:5-9` alone — five independent pieces of state, each with its own setter.

Two details worth slowing down on:

**Lazy initializers.** `App.jsx:9-12`:

```jsx
const [session, setSession] = useState(() => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) : null;
});
```

Notice `useState` is given a *function*, not a value directly. If it were `useState(localStorage.getItem(...))`, that `localStorage` read and `JSON.parse` would run on *every single render* of `App`, even though the result is only ever used once (on the very first render, to seed initial state). Passing a function tells React "only call this once, on mount." That's a deliberate performance/correctness choice — reading `localStorage` is cheap here, but the pattern matters generally: expensive initial-state computation goes in the lazy-initializer form.

**State that's an object.** `MenuManager.jsx:8`:

```jsx
const [form, setForm] = useState({ name: "", price: "", category: "" });
```

This is why you keep seeing the spread pattern, e.g. `MenuManager.jsx:82`:

```jsx
onChange={(e) => setForm({ ...form, name: e.target.value })}
```

React state updates *replace* the value, they don't merge into it (unlike old-style `this.setState` in class components, which did shallow-merge automatically). So `setForm({ name: e.target.value })` alone would silently wipe out `price` and `category`. `{ ...form, name: e.target.value }` copies every existing field and then overwrites just `name`. This is a real footgun worth internalizing now, because it's invisible until you lose data mid-form.

## `useEffect` — what it does, and when it actually runs

Plain English: components render synchronously — computing what the UI *looks like* — but some things (talking to `localStorage`, fetching from a server, subscribing to something) are side effects that shouldn't happen *during* rendering, only *after* React has actually updated the screen. `useEffect` is how you say "after you're done rendering, also do this."

Two real examples, two different reasons to use it.

`MenuManager.jsx:10-12`:

```jsx
useEffect(() => {
  loadMenu();
}, []);
```

The second argument, `[]`, is the **dependency array**. An empty array means "this effect doesn't depend on any reactive value, so React only needs to run it after the very first render (mount), not after every re-render." That's exactly the right tool here — you want to fetch the menu from the server once when `MenuManager` first appears, not on every re-render.

One dev-mode wrinkle worth knowing about upfront, because you'll actually see it: `main.jsx` renders `<App />` inside `<StrictMode>`. In React 18+ dev builds, StrictMode deliberately mounts a component, immediately runs its cleanup, and mounts it again — on purpose, to help you catch effects that aren't safe to run twice. That means when you run `npm run dev`, this exact effect — and its `loadMenu()` call to `api.listMenu()` — actually fires *twice* in a row on first load, not once; open the network tab and you'll see two requests. This is a development-only safety net: a production build (`npm run build` + serve) mounts once, and the effect really does run exactly once there. So "`[]` runs the effect once per mount" is the correct rule; "and never again, period" is only strictly true in production. In dev, under StrictMode, expect the double-fire and don't mistake it for a bug in your code.

`App.jsx:14-20`:

```jsx
useEffect(() => {
  if (session) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STORAGE_KEY);
  }
}, [session]);
```

Here the dependency array is `[session]`, not empty. That tells React: "re-run this effect after any render where `session` is a *different* value than it was last time." So every time `setSession(...)` is called anywhere (`App.jsx:29` on logout, `App.jsx:39` on login), React re-renders `App`, notices `session` changed, and *then* runs this effect again to sync `localStorage`. If you log in, this effect writes the session to storage; if you log out, it clears it.

**Why the dependency array exists at all** — it's not bureaucracy, it's the mechanism that prevents an effect from either (a) never re-running when it needs to, going stale, or (b) running on *every single render* regardless of relevance, which is wasteful and can cause infinite loops if the effect itself triggers a re-render. Omit the array entirely and the effect runs after every render, full stop. Pass `[]` and it runs once per mount. Pass `[session]` and it re-runs precisely when `session` changes — no more, no less. This is why `App.jsx:20` lists `session` specifically: that's the one piece of data the effect actually reads and reacts to.

Notice `MenuManager.jsx:12` uses `[]` even though `loadMenu` is a function defined inside the component (`MenuManager.jsx:14-23`) that the effect calls. In principle `loadMenu` could change identity on every render (it's redefined every time `MenuManager` runs), so a stricter setup could flag this as a missing dependency. This project's actual linter doesn't: the `lint` script in `package.json` runs `oxlint`, and `.oxlintrc.json` only turns on `react/rules-of-hooks` and `react/only-export-components` — not `exhaustive-deps` (oxlint supports that rule, it's simply not enabled here) — so running `oxlint src/components/MenuManager.jsx` exits clean with zero output. That doesn't mean the underlying concern is imaginary, only that this project's tooling won't catch it for you: `loadMenu` not being in the array is harmless *here specifically* because it doesn't close over any prop or state value that changes between renders in a way that matters for a mount-only fetch. But the general pattern — an effect calling a function that reads props or state, without that function or its inputs in the dependency array — is a real, common source of stale-closure bugs once effects get more complex than this one. Worth watching for by reading the code, since nothing here will flag it automatically.

**Alternative that was rejected:** you could skip `useEffect` for the `localStorage` sync entirely and just call `localStorage.setItem` directly inside `handleLogout` and inside the `onAuthenticated` callback, right next to each `setSession` call. That's more imperative and, for exactly two call sites, arguably not even wrong. The effect-based approach was chosen because it's **declarative and centralizes the rule in one place**: "whenever `session` is whatever it is, `localStorage` should match." That single source of truth is harder to get out of sync than two separate call sites you have to remember to update together every time you add a third place that changes `session`.

## Controlled form inputs

Plain English: a controlled input is one where React — not the browser — is the source of truth for the field's value. You don't ask the `<input>` "what do you currently contain"; you tell it what to contain, on every keystroke.

`AuthPanel.jsx:33`:

```jsx
<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
```

`value={email}` pins the input's displayed content to your `email` state. `onChange` fires on every keystroke and calls `setEmail(e.target.value)`, which re-renders `AuthPanel` with the new `email`, which flows back into `value={email}` — a tight, one-keystroke loop. It *feels* like the input is just typing normally, but structurally, React is redrawing that field's value on every character.

Same pattern for the multi-field form in `MenuManager.jsx:79-98` — `name`, `price`, `category` inputs all read from and write to the single `form` state object (`MenuManager.jsx:8`), each via the spread-and-overwrite pattern shown earlier.

**Why controlled, when uncontrolled inputs exist:** React does support uncontrolled inputs — leave off `value`, let the DOM manage the field itself, and only reach in with a `ref` when you need the value (typically on submit). That's less code per field and is genuinely the better choice for things like a single one-off search box you only read once. It was not chosen here because this project needs to *programmatically* change field values from code, not just read them at the end: `MenuManager.jsx:29` needs to **reset the whole form to blank** after a successful add — `setForm({ name: "", price: "", category: "" })` (the line above it, `MenuManager.jsx:28`, is the `await api.createMenuItem(...)` call that triggers this reset). That's trivial with controlled inputs — just set state, and the inputs redraw empty because they're pinned to it — and awkward with uncontrolled ones, where you'd need refs to imperatively clear three separate DOM nodes by hand.

## Conditional rendering

Plain English: since JSX is just JavaScript expressions inside `{}`, "conditional rendering" isn't a special React feature — it's just `if`, ternaries, and `&&`, used to decide what value gets returned from a component.

Four different real patterns, all doing the same underlying thing:

**Ternary for either/or.** `App.jsx:26-33` — either the signed-in header bar or the guest message, never both:

```jsx
{session ? (
  <div className="session-bar">...</div>
) : (
  <span className="session-bar">Browsing as a guest</span>
)}
```

**`&&` for show-or-nothing.** `App.jsx:38-40` — `AuthPanel` only renders at all when there's no session:

```jsx
{!session && (
  <AuthPanel onAuthenticated={...} />
)}
```

This works because `false && anything` short-circuits to `false`, and React simply renders nothing for `false`/`null`/`undefined`. Same trick guards the whole edit-controls block in `MenuManager.jsx:61-70` — those buttons only exist in the tree at all `{token && (...)}` — and, inside that block, the two buttons themselves are grouped in a Fragment (`<>...</>`, `MenuManager.jsx:62`/`:69`) so they render as siblings without an extra wrapper element, the same Fragment mentioned back in the JSX section.

**Early return for whole-component states.** `MenuManager.jsx:46-47`:

```jsx
if (status === "loading") return <p>Loading menu…</p>;
if (status === "error") return <p className="error" role="alert">Couldn't load the menu: {error}</p>;
```

This is the cleanest pattern when a component has genuinely distinct top-level states (loading / error / ready) — rather than nesting the *entire* return value in a giant ternary, you bail out early with a small return and let the "happy path" markup (`MenuManager.jsx:49-103`) stay flat and readable.

**Ternary for empty-state vs. populated-state.** `MenuManager.jsx:52-54`, deciding between a "nothing here yet" message and the actual list.

The `status` field itself (`MenuManager.jsx:6`, `"loading" | "ready" | "error"`) is worth noticing as a design choice: it's one piece of state describing which of three mutually-exclusive UI states you're in, rather than two separate booleans like `isLoading` and `hasError`. With two booleans you can accidentally represent a nonsense state (`isLoading: true, hasError: true` simultaneously) that the UI then has to defensively guard against. A single enum-like string can't be in two states at once by construction — cheap insurance against a whole category of bug.

## Rendering lists with `key`

Plain English: when React turns an array into a list of elements, it needs a stable way to tell "this is the same item as last render, just possibly with different data" apart from "this is a brand new item" — otherwise, on every re-render, it can't tell whether to update an existing DOM node or tear down and rebuild one. `key` is that identity tag, and it's not optional in any real sense — leaving it off, or getting it wrong, causes real bugs (wrong item's edit state showing on the wrong row, lost input focus, form fields silently drifting to the wrong item) as soon as the list is reordered, filtered, or has an item removed from the middle.

`MenuManager.jsx:56-57`:

```jsx
{items.map((item) => (
  <li key={item.id} className={item.available ? "" : "unavailable"}>
```

`key={item.id}` uses the server-assigned, stable `id` — the right choice, because it uniquely identifies *that specific menu item* regardless of what position it happens to be sorted into or whether items above it get deleted (`MenuManager.jsx:41-44`, `handleDelete`). The common beginner mistake is `key={index}` — the array index — which *looks* like it satisfies React's "you need a key" warning but silently breaks the moment the list order changes or an item is removed from the middle, because index 2 now refers to a *different* menu item than it did a render ago, and React will happily reuse and misattribute DOM state across that seam. `item.id` doesn't have that problem because it travels with the item, not with its position.

## The one-way, top-down data flow model

This is the concept that ties everything above together, so it's worth naming explicitly even though you've already seen it working.

Plain English: data in React only flows in one direction — down, from parent to child, as props. It never flows back up directly. If a child needs to affect something in a parent, the parent has to explicitly hand the child a *function* to call — the child triggers change by calling that function, it never reaches up and touches the parent's state itself. You already saw the mechanics of exactly this in **Props vs. state** above: `App` handing `AuthPanel` the `onAuthenticated` callback (`App.jsx:39`), and `AuthPanel` calling that function rather than touching `setSession` directly (`AuthPanel.jsx:19-20`). This section isn't a new mechanism — it's that same one, zoomed out to the scale of the whole app.

Trace it end to end: `App` is the single owner of `session` state (`App.jsx:9`). Everything downstream is a *consequence* of that one value:

- `session?.token` flows down into `MenuManager` as the `token` prop (`App.jsx:37`) — which is why `MenuManager.jsx:61`, `{token && (...)}`, can decide to show/hide the edit controls: it's reacting to a value it was *given*, not one it manages.
- The `onAuthenticated` callback (`App.jsx:39`) is the one path data can travel back *up* the tree — and only because `App` explicitly built that path by handing down a function, not because `AuthPanel` reached for it on its own.
- `App`'s `useEffect` (`App.jsx:14-20`) reacts to `session` changing and writes to `localStorage` — a side effect *downstream* of the state change, never a cause of it.

The practical payoff: if something is wrong on screen — say, the login form still showing when it shouldn't — you know exactly where to look, because there is exactly one place `session` can change (`App.jsx:9`'s setter, called from two spots: `App.jsx:29` and `App.jsx:39`). Compare that to a hypothetical version where `AuthPanel` and `MenuManager` could each independently decide "I think we're logged in now" — you'd have two sources of truth that could disagree, and no way to know which one is right. One-way data flow is what makes "where do I even start debugging this" a tractable question instead of a scavenger hunt.

## Self-check

1. In `App.jsx:37`, `<MenuManager token={session?.token} />` — is `token` a prop or state, *from `MenuManager`'s point of view*? What about from `App`'s point of view — is `session` a prop or state there?
2. If you deleted the `[]` from `MenuManager.jsx:12` entirely (no dependency array at all, not even empty), what would actually happen the next time `MenuManager` re-renders — and why would that be a problem given what `loadMenu` does?
3. `AuthPanel.jsx:33`'s email input has no `key` prop, but `MenuManager.jsx:57`'s `<li>` does. Why does one need a `key` and the other doesn't?
4. Suppose `MenuManager.jsx:82` were changed to `setForm({ name: e.target.value })` instead of `setForm({ ...form, name: e.target.value })`. What would happen to the `price` and `category` fields the next time you typed into the `name` field, and why?
5. Walk through what happens, step by step, from the moment a user clicks "Log out" (`App.jsx:29`) to the header re-rendering as "Browsing as a guest" (`App.jsx:32`). Which lines execute, in what order?

## My notes

## Things I found hard (ask for a deeper explanation)