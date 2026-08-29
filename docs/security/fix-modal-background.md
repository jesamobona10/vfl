# Fix: Transparent Modal / Panel Backgrounds

**Symptom:** Modals (and other panels — dropdowns, notifications, cards) render with a see-through background, so whatever is behind them bleeds through and text overlaps.

**Root cause:** Invalid CSS, not a z-index or component bug. `tailwind.config.ts` builds theme colors like this:

```ts
surface: { DEFAULT: "rgb(var(--surface) / <alpha-value>)" }
```

But `app/globals.css` defines `--surface` as a **comma-separated** triplet:

```css
--surface: 255, 255, 255;
```

Substituted together, that compiles to:

```css
background-color: rgb(255, 255, 255 / 1);
```

Mixing the legacy comma syntax with a slash-based alpha is **invalid CSS**. Browsers don't approximate an invalid value — they drop the whole declaration, so `background-color` never gets set and the element stays transparent. This hits every color token that uses the `rgb(var(--x) / <alpha-value>)` pattern: `bg-surface`, `bg-surface-2`, `text-muted`, `border-line`, `bg-brand-50`, `bg-brand-100`, and all the `-tint` colors — which is why the whole screen looks broken, not just one modal.

**The fix:** remove the commas so each variable holds a space-separated triplet, which is what that Tailwind pattern actually requires. No component code changes needed.

---

## 1. `app/globals.css`

Find the `:root` block and replace these 13 lines:

```css
/* BEFORE */
:root {
  --bg: 247, 250, 246;
  --surface: 255, 255, 255;
  --surface-2: 237, 242, 236;
  --text: 22, 33, 26;
  --muted: 91, 106, 93;
  --ink-3: 147, 160, 146;
  --line: 225, 232, 224;
  /* ... */
  --brand-600-rgb: 11, 95, 53;
  /* ... */
  --brand-50-rgb: 234, 246, 238;
  --brand-100-rgb: 207, 235, 216;
  --gold-tint-rgb: 251, 240, 220;
  --live-tint-rgb: 228, 246, 238;
  --danger-tint-rgb: 251, 234, 232;
  --warn-tint-rgb: 251, 240, 220;
```

```css
/* AFTER */
:root {
  --bg: 247 250 246;
  --surface: 255 255 255;
  --surface-2: 237 242 236;
  --text: 22 33 26;
  --muted: 91 106 93;
  --ink-3: 147 160 146;
  --line: 225 232 224;
  /* ... */
  --brand-600-rgb: 11 95 53;
  /* ... */
  --brand-50-rgb: 234 246 238;
  --brand-100-rgb: 207 235 216;
  --gold-tint-rgb: 251 240 220;
  --live-tint-rgb: 228 246 238;
  --danger-tint-rgb: 251 234 232;
  --warn-tint-rgb: 251 240 220;
```

Then the `.dark` block — same change, 13 more lines:

```css
/* BEFORE */
.dark {
  --bg: 10, 15, 11;
  --surface: 20, 27, 21;
  --surface-2: 30, 39, 31;
  --text: 232, 238, 231;
  --muted: 154, 168, 155;
  --ink-3: 110, 122, 112;
  --line: 44, 55, 46;
  /* ... */
  --brand-600-rgb: 31, 138, 84;
  /* ... */
  --brand-50-rgb: 26, 46, 33;
  --brand-100-rgb: 34, 60, 43;
  --gold-tint-rgb: 58, 47, 22;
  --live-tint-rgb: 19, 48, 36;
  --danger-tint-rgb: 56, 28, 25;
  --warn-tint-rgb: 54, 42, 20;
```

```css
/* AFTER */
.dark {
  --bg: 10 15 11;
  --surface: 20 27 21;
  --surface-2: 30 39 31;
  --text: 232 238 231;
  --muted: 154 168 155;
  --ink-3: 110 122 112;
  --line: 44 55 46;
  /* ... */
  --brand-600-rgb: 31 138 84;
  /* ... */
  --brand-50-rgb: 26 46 33;
  --brand-100-rgb: 34 60 43;
  --gold-tint-rgb: 58 47 22;
  --live-tint-rgb: 19 48 36;
  --danger-tint-rgb: 56 28 25;
  --warn-tint-rgb: 54 42 20;
```

Everything else in the file (hex values like `--brand: #0f7c45`, and shadow values) is untouched — only the RGB-triplet variables that feed the `<alpha-value>` pattern need this.

## 2. `tailwind.config.ts`

One more spot with the same bug — the fallback baked into the `ink-3` color:

```ts
/* BEFORE */
3: "rgb(var(--ink-3, 147, 160, 146) / <alpha-value>)",
```

```ts
/* AFTER */
3: "rgb(var(--ink-3, 147 160 146) / <alpha-value>)",
```

---

## 3. Apply and verify

1. Make the edits above in `app/globals.css` and `tailwind.config.ts`.
2. Restart the dev server — `globals.css` changes need a fresh Tailwind build, not just hot reload:
   ```bash
   npm run dev
   ```
3. Open a modal (e.g. Add Event) and confirm the panel now has a solid background with no bleed-through from the page behind it.
4. Spot-check a dropdown (season selector, filters) and a card in dark mode too, since they use the same broken tokens.

## Why this is easy to miss

Both syntaxes look correct in isolation — `rgb(255, 255, 255)` is valid, and `rgb(var(--surface) / 1)` looks valid in the Tailwind config. The break only happens once the variable is substituted in and the two styles collide. This is also why nothing shows up as a build error: it's valid at parse time from each file's point of view, and only becomes an invalid *value* after CSS custom property substitution, which happens in the browser, not at build time.
