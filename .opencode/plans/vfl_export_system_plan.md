# VFL Export System Implementation Plan

## Overview
This plan implements the VFL Export System as described in `docs/security/VFL_EXPORT_SYSTEM_IMPLEMENTATION.md`. The goal is to fix broken and inconsistent PNG/PDF downloads across mobile, tablet, and desktop by creating a dedicated export template that renders at a fixed width (1400px) independent of the user's viewport.

## Current State Analysis

### Current Issues
1. **Viewport-dependent exports**: Current implementation uses `windowWidth: 390` (mobile) causing desktop tables to be clipped
2. **Responsive UI captured directly**: The responsive standings table with sticky columns, horizontal scrolling, and mobile layouts is captured directly
3. **Hardcoded mobile viewport**: `windowWidth: 390` hardcoded in export utility
4. **No dedicated export template**: The live responsive UI is captured directly instead of a fixed-width export template

### Current Architecture
```
Responsive Standings UI → html2canvas (windowWidth: 390) → PNG/PDF
```

### Target Architecture
```
Standings Data
       │
       ├── Responsive UI (current standings-table.tsx)
       │
       └── Export Template (NEW: standings-export.tsx)
                    │
                    ▼
              Export Engine (updated export.ts)
                    │
                    ├── PNG
                    └── PDF
```

---

## Implementation Plan

### Phase 1: Create Standings Export Component
**File**: `components/standings/standings-export.tsx`

**Requirements:**
- Fixed width: 1400px (per spec)
- No responsive breakpoints
- No sticky positioning
- No horizontal scrolling
- Controlled background (white)
- Include branding, metadata, timestamp
- Render same standings data as visible UI
- Position off-screen: `position: fixed; left: -10000px; top: 0;`
- Include `crossOrigin="anonymous"` on team logos for CORS
- Use inline styles (no Tailwind classes that might conflict)

**Props Interface:**
```typescript
interface StandingsExportProps {
  standings: StandingRow[];
  teams: Team[];
  leagueName?: string;
  seasonName?: string;
}
```

**Key Features:**
- Fixed width: 1400px
- Padding: 48px
- Professional header with league name, season, generation timestamp
- Table with all columns (including GF, GA, Rating when not in overview mode)
- Alternating row colors
- Form guide with colored indicators
- Footer with branding
- Team logos with `crossOrigin="anonymous"`
- Positioned off-screen: `left: -10000px`

---

### Phase 2: Update Export Utility (`lib/utils/export.ts`)

**Changes Required:**
1. **Remove hardcoded `windowWidth: 390`** - Use actual element dimensions
2. **Update `exportAsPNG`**:
   - Remove `width` parameter (default 390)
   - Use `element.scrollWidth` and `element.scrollHeight`
   - Set `windowWidth` and `windowHeight` to actual dimensions
   - Add `waitForAssets` to wait for images/fonts
   - Use `scale: 2` for high DPI
2. **Update `exportAsPDF`**:
   - Use actual element dimensions
   - Landscape A4 with proper margins
   - Handle multi-page if content exceeds page height
3. **Add `waitForAssets` helper**:
   - Wait for all images to load
   - Wait for fonts to load (`document.fonts.ready`)

**New Implementation Details:**
```typescript
// waitForAssets - wait for images and fonts
async function waitForAssets(element: HTMLElement): Promise<void>

// createExportCanvas - unified canvas creation
async function createExportCanvas(element: HTMLElement): Promise<HTMLCanvasElement>

// exportAsPNG - use actual dimensions
export async function exportAsPNG(element: HTMLElement, filename: string): Promise<void>

// exportAsPDF - use actual dimensions, landscape A4
export async function exportAsPDF(
  element: HTMLElement, 
  filename: string, 
  title?: string
): Promise<void>
```

---

### Phase 3: Create Standings Export Component
**File**: `components/standings/standings-export.tsx`

**Implementation Details:**
- Use `forwardRef` for ref forwarding
- Fixed width: 1400px
- Professional header with league name, season, timestamp
- Table with all columns (adapt based on overview mode)
- Alternating row colors
- Form guide with colored dots (W/D/L)
- Team logos with `crossOrigin="anonymous"`
- Professional footer
- Off-screen positioning via inline styles

---

### Phase 4: Update Standings Table (`standings-table.tsx`)

**Changes:**
1. **Import** the new export component:
   ```typescript
   import { StandingsExport } from "./standings-export";
   ```

2. **Add export ref**:
   ```typescript
   const exportRef = useRef<HTMLDivElement>(null);
   ```

3. **Update download handlers**:
   ```typescript
   const handleDownloadPNG = async () => {
     setMenuOpen(false);
     if (!exportRef.current) return;
     try {
       await exportAsPNG(exportRef.current, "leagueforge-standings.png");
     } catch (error) {
       console.error("Failed to export standings PNG:", error);
     }
   };

   const handleDownloadPDF = async () => {
     setMenuOpen(false);
     if (!exportRef.current) return;
     try {
       await exportAsPDF(
         exportRef.current, 
         "leagueforge-standings.pdf", 
         "League Standings"
       );
     } catch (error) {
       console.error("Failed to export standings PDF:", error);
     }
   };
   ```

3. **Render export component** in JSX (at end of component):
   ```tsx
   <>
     <div className="panel" ref={tableRef}>
       {/* Existing interactive standings UI */}
     </div>

     <StandingsExport
       ref={exportRef}
       standings={rows}
       teams={teams}
       leagueName="VUNA LEAGUE"
       seasonName={currentSeason?.name || "2026 Season"}
     />
   </>
   ```

---

### Phase 5: Update Export Utility (`lib/utils/export.ts`)

**Complete rewrite of export functions:**

Key changes:
- Remove `width` parameter from `exportAsPNG`
- Use `element.scrollWidth` / `element.scrollHeight`
- Set `windowWidth` and `windowHeight` to actual dimensions
- Add `waitForAssets` for images/fonts
- Update `exportAsPDF` for landscape A4 with proper scaling
- Remove hardcoded `windowWidth: 390`

---

### Phase 6: Testing & Validation

**Test Scenarios:**
1. Mobile (375px) - PNG export should be 1400px wide
2. Desktop (1920px) - PNG export should be 1400px wide
3. Tablet (768px) - PNG export should be 1400px wide
4. PDF export on mobile/desktop
5. 2 teams, 12 teams, 20+ teams
6. Team logos with CORS
4. Form guide rendering
5. Advanced columns toggle

**Acceptance Criteria (from spec):**
- [ ] PNG export looks identical regardless of device viewport
- [ ] Mobile users receive full desktop-quality standings document
- [ ] No columns overlap
- [ ] No sticky columns appear incorrectly
- [ ] No horizontal content is clipped
- [ ] Team logos appear correctly
- [ ] Form indicators remain aligned
- [ ] Background colors are consistent
- [ ] PNG export works on mobile/desktop
- [ ] PDF export works on mobile/desktop
- [ ] JSON export remains unchanged
- [ ] Works with 2, 12, 20+ teams
- [ ] html2canvas/jspdf remain lazy-loaded
- [ ] Fonts/images loaded before capture
- [ ] Export UI does not affect visible page layout

---

## File Changes Summary

### New Files
1. `components/standings/standings-export.tsx` - New export template component

### Modified Files
1. `lib/utils/export.ts` - Complete rewrite of export functions
2. `components/standings/standings-table.tsx` - Add export ref, update handlers, render export component
3. `app/org/[slug]/competitions/[cId]/standings/page.tsx` - Pass season name to standings table (optional)

---

## Implementation Order

1. **First**: Create `components/standings/standings-export.tsx`
2. **Second**: Update `lib/utils/export.ts` with new export functions
3. **Third**: Update `components/standings/standings-table.tsx` to use new export component
4. **Fourth**: Test and validate across devices

---

## Key Technical Decisions

| Decision | Rationale |
|----------|-----------|
| Fixed width 1400px | Per spec, works for all team counts |
| Off-screen positioning (`left: -10000px`) | `html2canvas` can't capture `display: none` |
| `crossOrigin="anonymous"` on logos | CORS handling for external images |
| Inline styles on export component | Avoid Tailwind/class conflicts during capture |
| Fixed 1400px width in export utility | Consistent output across all devices |
| Landscape A4 PDF | Better for wide standings tables |
| Lazy-loaded html2canvas/jspdf | Keep bundle size small |

---

## Dependencies

**Already installed:**
- `html2canvas` - for canvas capture
- `jspdf` - for PDF generation
- `lucide-react` - icons (already used)
- `date-fns` - date formatting (already used)

**No new dependencies required.**

---

## Rollback Plan

If issues arise:
1. Revert `standings-table.tsx` to use `tableElementRef` for exports
2. Revert `lib/utils/export.ts` to previous version
4. Remove `standings-export.tsx`

All changes are localized to standings export functionality.

---

## Timeline Estimate

| Phase | Estimated Time |
|-------|----------------|
| Phase 1: Create export component | 30 min |
| Phase 2: Update export utility | 30 min |
| Phase 3: Update standings table | 30 min |
| Phase 4: Testing & validation | 30 min |
| **Total** | **~2 hours** |

---

## Questions for Clarification

1. **League/Season naming**: Should `leagueName` and `seasonName` be dynamic from the competition/season data, or use static values ("VUNA LEAGUE", "2026 Season")?

2. **Season name in export**: The standings table doesn't currently receive the season name. Should we pass it from the standings page?

3. **Advanced columns in export**: Should the export include advanced columns (xG, xGA, etc.) when "Show Advanced" is toggled, or always include full columns?

4. **Logo CORS**: Are team logos hosted on a CORS-enabled CDN (Cloudinary with public access)? If not, logos may not appear in exports.

5. **Mobile testing**: Do we have access to mobile device testing, or should we rely on Chrome DevTools device toolbar?

---

## Next Steps

Once you approve this plan, I'll implement:
1. `components/standings/standings-export.tsx`
2. Update `lib/utils/export.ts`
3. Update `components/standings/standings-table.tsx`
4. Run typecheck, lint, tests, and build