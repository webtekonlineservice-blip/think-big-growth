# B&I Family Feud — UI Design Guide

## BNI Brand Theme

### Colors
| Token | Hex | Usage |
|-------|-----|-------|
| BNI Red | `#CC0000` | Primary — buttons, headings, accents |
| BNI Dark Red | `#990000` | Hover states, darker accents |
| BNI Black | `#1A1A1A` | Background, text on light |
| Dark BG | `#111111` | Page backgrounds |
| Card BG | `#1F1F1F` | Card/panel backgrounds |
| White | `#FFFFFF` | Text on dark, card backgrounds |
| Gold/Yellow | `#FFD700` | Scores, points, highlights |
| Light Gray | `#F5F5F5` | Secondary text on dark |
| Muted | `#666666` | Tertiary text, labels |

### Typography
- **Headings**: Bold, large — impact feel (game show vibe)
- **Body**: Clean sans-serif (system font stack)
- **Numbers/Scores**: Extra bold, gold color

### Design Principles
1. **Dark background** — game show atmosphere, easy to read on projector
2. **BNI Red accents** — brand recognition, action buttons
3. **Gold for scores** — points and achievements pop
4. **High contrast** — readable from the back of the room
5. **Large text** — board screen viewed from 15+ feet away

---

## Screen Designs

### Board (Projected on TV)
- Full dark background (#111111)
- BNI Red header bar with logo
- Question in large white text on dark card
- Answer slots: Red (hidden) → Green (revealed)
- Points in gold
- Player count in gold
- QR code on white background for contrast
- Strikes in bright red with animation

### Host (Phone/Laptop)
- Dark background matching board
- BNI Red buttons for primary actions (Open Round, Show QR)
- Member grid with initials in red circles
- Active round highlighted with gold border
- Live answer feed with green (match) / red (miss) indicators
- Compact layout — works on phone

### Registration (QR Screen)
- Centered layout, minimal
- Giant QR code on white card
- Phone number in gold, extra large
- Player count animated
- BNI Red accent bar at top

---

## Component Patterns

### Buttons
- **Primary**: BNI Red bg, white text, rounded-xl
- **Secondary**: White/10 bg, white text, rounded-xl  
- **Danger**: Dark red bg (strikes)
- **Disabled**: 50% opacity

### Cards
- Dark card bg (#1F1F1F)
- Subtle border (white/10)
- Rounded-2xl
- Padding: p-4 to p-6

### Answer Slots
- **Hidden**: BNI Red background, blurred text
- **Revealed**: Green background, white text, points in gold
- Transition: 500ms flip animation feel

### Modals
- Full-screen overlay (black/80)
- Centered card with rounded corners
- Close on backdrop click
- Header with member avatar/initials

---

## Responsive Breakpoints
- **Board**: Designed for 1080p+ displays, large text
- **Host**: Works on phone (375px) and desktop
- **QR Modal**: Full viewport, scales QR to fit

---

## Tailwind Config Tokens
```js
// tailwind.config.js extend
colors: {
  bni: {
    red: '#CC0000',
    'red-dark': '#990000',
    'red-light': '#FF1A1A',
    black: '#1A1A1A',
    gold: '#FFD700',
  }
}
```
