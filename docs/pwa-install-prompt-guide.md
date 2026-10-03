# PWA Install Prompt — Implementation Guide

## The thing to know before writing any prompt-display code

Checked directly: the manifest (`public/manifest.json`) is solid — has `name`, `start_url`, `display: standalone`, `background_color`, `theme_color`, an icon. But there's still no service worker anywhere in the project. Chrome's installability criteria require **both** a valid manifest **and** a registered service worker — without one, `beforeinstallprompt` simply won't fire, no matter how good the prompt-display code is. So this isn't optional groundwork, it's a hard prerequisite.

Worth building a real minimal service worker now rather than an empty stub — it can precache the app shell (satisfying installability) while also being the exact foundation the offline match-event queue from a couple sessions back will need later. Same file, two birds.

One more thing worth checking while in here: the manifest's only icon is SVG with `"sizes": "any"`. That's increasingly accepted, but adding standard 192×192 and 512×512 PNG icons alongside it is the safer, more broadly-compatible choice — worth doing in the same pass rather than finding out later a specific browser version didn't accept the SVG-only icon.

---

```
Implement a PWA install prompt that appears when a user opens the web app,
if they haven't installed it and haven't recently dismissed the prompt.

1. SERVICE WORKER (prerequisite — do this first)
   Create public/sw.js: a minimal service worker that precaches the app
   shell (the root route, manifest, icons) on install, and serves from
   cache with a network-falling-back-to-cache strategy on fetch. Register
   it from the root layout or a small client component, guarded by
   `if ('serviceWorker' in navigator)`. Keep this genuinely minimal for now
   — just enough to satisfy installability and establish the pattern; the
   richer offline-queue behavior (IndexedDB-backed, Background Sync) is a
   separate, later piece of work and shouldn't be bundled into this change.

2. ICONS
   Add 192x192 and 512x512 PNG icons to public/manifest.json's icons array
   alongside the existing SVG entry, for broader installability compatibility.

3. INSTALL-PROMPT COMPONENT
   Create a client component (e.g. components/shared/install-prompt.tsx):
   - On mount, listen for the `beforeinstallprompt` event on `window`.
     Call `event.preventDefault()` and store the event in state/ref — this
     is required to defer the browser's automatic prompt and show it later
     on your own terms.
   - Detect if already installed: check
     `window.matchMedia('(display-mode: standalone)').matches` (covers
     Chrome/Android) OR `window.navigator.standalone` (iOS Safari's legacy
     equivalent). If either is true, never show the prompt.
   - If a `beforeinstallprompt` event was captured and the app isn't
     already installed, show a custom install banner/card (not the raw
     browser UI — build your own, matching the existing design system).
     On the user tapping "Install", call the stored event's `.prompt()`
     method, then check `.userChoice` to know whether they accepted or
     dismissed.
   - On dismiss (either your own banner's dismiss button, or the user
     declining the native prompt), store a dismissal timestamp in
     localStorage — this is simple, small, non-critical UI state, so
     localStorage is the right tool here (unlike the structured offline
     event queue from the earlier offline-sync work, which needs
     IndexedDB). Don't show the prompt again for some cooldown period
     (e.g. 7 days) after a dismissal — respect the user saying no.

4. iOS HANDLING (no beforeinstallprompt support at all on Safari/iOS)
   Detect iOS via `navigator.userAgent` or `navigator.platform` (there's no
   beforeinstallprompt event to listen for there). If on iOS, not already
   installed (`navigator.standalone` is false), and not recently
   dismissed, show a different, instructional variant of the banner:
   "Tap the Share button, then 'Add to Home Screen'" — iOS has no
   programmatic install API, so this is manual instructions, not a button
   that triggers anything.

5. MOUNT IT APP-WIDE
   Render the install-prompt component from the root layout (app/layout.tsx)
   or the shared AppShell, so it can appear regardless of which page a user
   lands on first — matching "anytime a user opens the web app."

GUARDRAILS
- Don't block or delay the rest of the page from rendering while this
  component initializes — it should mount silently and only show UI once
  it has something to show.
- Respect the dismissal cooldown — a prompt that reappears on every single
  visit after being dismissed is the kind of thing that makes people
  distrust an app, not install it.
- Keep the service worker minimal in this change — resist the temptation
  to fold the full offline-queue/Background-Sync work in here too; that's
  a separate, larger piece with its own correctness concerns (idempotency,
  retry logic) already discussed and deserves its own review.
```
