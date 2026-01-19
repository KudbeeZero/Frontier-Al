# FRONTIER Design Guidelines
**Algorand Strategy Game - Cyberpunk Military Aesthetic**

## Design Approach
**Reference-Based**: Drawing from cyberpunk gaming interfaces (Cyberpunk 2077, XCOM 2, StarCraft II) combined with modern Web3 dashboards (Uniswap, Aave) to create a tactical, immersive war room experience.

**Core Principle**: Military command center meets futuristic battlefield - every interface element should feel purposeful, tactical, and information-dense without overwhelming the player.

---

## Typography System

**Primary Font**: "Rajdhani" (Google Fonts) - Angular, tactical, perfect for headings and UI labels  
**Secondary Font**: "Inter" (Google Fonts) - Clean readability for body text and data

**Hierarchy**:
- Game Title/Hero: Rajdhani Bold, 48px (mobile: 32px)
- Section Headers: Rajdhani SemiBold, 32px (mobile: 24px)
- Panel Titles: Rajdhani Medium, 20px
- Body Text: Inter Regular, 16px
- UI Labels/Stats: Inter Medium, 14px
- Small Data: Inter Regular, 12px

---

## Layout & Spacing

**Spacing Scale**: Tailwind units of **2, 4, 6, 8, 12** (p-2, m-4, gap-6, py-8, space-y-12)

**Grid Structure**:
- Main game canvas: Full viewport with fixed UI panels overlaid
- Desktop: Sidebar panels (320px fixed), center hex grid (flex-1)
- Mobile: Full-screen grid with bottom sheet panels (swipe-up)
- Container max-width: No max-width for game view, 1400px for marketing pages

**Panel System**:
- Left Panel: Base info + actions (z-20, glass morphism)
- Right Panel: War room + AI feed (z-20, glass morphism)
- Bottom HUD: Resource counters, persistent (z-30)
- Top Bar: Wallet + settings (z-40)

---

## Component Library

### Core UI Elements

**Buttons**:
- Primary Action: Full opacity background with glow effect, uppercase text
- Secondary: Border-only with hover fill
- Danger/Attack: Red accent with warning icon
- All buttons: Rajdhani Medium, py-3 px-6, rounded corners (4px sharp edges for tactical feel)

**Cards/Panels**:
- Glass morphism: backdrop-blur-md with 10% opacity dark overlay
- Sharp corners (rounded-md at most, prefer sharp for military aesthetic)
- Thin border (1px) with subtle glow on hover
- Internal padding: p-6

**Hex Tiles** (PixiJS Canvas):
- Outlined hexagons with biome-specific fill patterns
- Owner indicator: Border glow (player vs AI color-coded)
- State indicators: Icons overlaid (mine, fortress, battle)
- Hover: Elevation effect with info tooltip

**Resource Display**:
- Icon + numerical counter + progress bar
- Horizontal layout for HUD
- Color-coded: Iron (steel blue), Fuel (amber), Crystal (purple)

**Progress Bars**:
- Thin (h-2), sharp corners
- Animated fill with pulsing glow when active
- Cooldown timers: Circular progress around action buttons

### Navigation

**Top Bar**:
- Sticky, full-width, backdrop-blur
- Left: Game logo + status indicator (online/syncing)
- Right: Wallet address (truncated), ALGO balance, settings icon
- Mobile: Hamburger menu for collapsible navigation

### Forms & Inputs

**Input Fields**:
- Dark background with subtle inner shadow
- Focused state: Border glow
- Labels: Uppercase, tracking-wide, mb-2
- Number inputs for resources: Steppers integrated

**Dropdowns/Selects**:
- Custom styled (not native) for consistency
- Dark dropdown with hover highlights
- Icons for options where applicable

### Data Displays

**Battle Feed**:
- Timeline list (vertical)
- Each event: Icon + timestamp + description
- Real-time updates fade in from top
- Max height with scroll

**Stats Grid**:
- 2-3 column grid for player/base stats
- Label + large numeric value
- Comparison indicators (arrows for change)

**Map Legend**:
- Compact, collapsible
- Color swatches + labels for biomes/states
- Accessibility toggle for color-blind modes

### Overlays

**Modals**:
- Full-screen overlay (backdrop-blur-sm)
- Centered card (max-w-2xl)
- Close button (top-right)
- Action buttons at bottom

**Tooltips**:
- Small, positioned near cursor/element
- Arrow pointer to source
- Instant show, 200ms fade out
- Contains: Title + description + stats

**Notifications/Toasts**:
- Top-right stacked
- Auto-dismiss (5s) or manual close
- Success/Error/Info color-coded
- Include transaction hash link for blockchain actions

---

## Images & Visual Assets

**Hero Section** (Marketing/Landing):
- Large hero image: Futuristic battlefield/war room concept art (1920x800px minimum)
- Dark overlay (60% opacity) for text readability
- Buttons on hero: Blurred glass background (backdrop-blur-lg)

**In-Game Visuals**:
- No decorative images in UI panels (focus on data/function)
- Icons: Heroicons (outline for inactive, solid for active)
- Hex biome textures: Procedural or tiled patterns in PixiJS
- Battle animations: Particle effects (explosions, projectiles)

**Marketing Pages**:
- Feature showcase: Screenshots of game interface (3-4 images in grid)
- Team section: Optional (focus on tech/game, not faces)
- Blockchain integration: Algorand logo, transaction flow diagrams

---

## Accessibility & Responsiveness

**Color-Blind Modes**:
- Toggle in settings
- Adjusts hex borders and resource icons to patterns + shapes
- Deuteranopia/Protanopia tested combinations

**Responsive Breakpoints**:
- Mobile: < 640px (single column, bottom sheets)
- Tablet: 640-1024px (collapsible sidebars)
- Desktop: > 1024px (full panel layout)

**Touch Targets**:
- Minimum 44x44px for mobile buttons
- Hex tiles: Larger tap zones than visual hexagon
- Swipe gestures: Pan map, pull-up panels

**Keyboard Navigation**:
- Tab order: Top bar → Left panel → Center → Right panel
- Arrow keys: Navigate hex grid
- Shortcut hints in tooltips

---

## Animation Guidelines

**Minimal Use**:
- UI transitions: 150-200ms ease-in-out (panel slides, fades)
- Hover effects: Instant glow/scale (no delay)
- Battle resolution: 2-3s animation sequence (PixiJS particles)
- Resource updates: Count-up animation (1s)
- Loading states: Subtle pulse on data fetch

**No Animations**:
- Page load (instant render)
- Text content
- Background elements

---

## Design Execution Notes

- **Information Density**: Strategy games thrive on data - don't over-simplify panels
- **Tactical Feel**: Sharp edges, monospaced numbers, uppercase labels, grid alignments
- **Glows & Effects**: Use sparingly for active states, danger warnings, and owned territory
- **Scan-lines**: Optional subtle overlay on panels for cyberpunk aesthetic (5% opacity)
- **Sound Cues**: Prepare for future audio (UI clicks, battle sounds) but not in V1.1

---

**Design System**: Custom tactical UI inspired by military interfaces + Web3 dashboards  
**Primary Reference**: XCOM 2 UI + Cyberpunk 2077 menus + Linear app's precision  
**Key Differentiator**: Blockchain-verified strategy game with real-time data visualization in a premium, immersive war room interface