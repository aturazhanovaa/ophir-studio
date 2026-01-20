# UI Guide (Enterprise Security + Analytics)

## Design Tokens
- Colors
  - Primary: `#00AEEF`
  - Primary strong: `#008FC6`
  - Background: `#F7F9FB`
  - Surface: `#FFFFFF`
  - Border: `#E1E7EF`
  - Text: `#0D1B2A`
  - Muted: `#607086`
  - Success: `#1F8F6F`
  - Warning: `#B7791F`
  - Error: `#C83349`
  - Info: `#2D7FF2`
- Typography
  - Font stack: Sora / Space Grotesk / Work Sans with system fallback
  - Headings: tight tracking, stronger weight
- Spacing
  - Use `--space-sm` (10px), `--space-md` (16px), `--space-lg` (24px)
- Radius
  - Small: 8px
  - Medium: 12px
  - Large: 16px
- Shadow
  - Subtle cards: `--shadow-sm`
  - Hover lift: `--shadow-md`

## Components
- Buttons
  - Primary: `.btn.btnPrimary` for main CTAs
  - Secondary: `.btn.btnSecondary` for supporting actions
  - Tertiary: `.btn.btnTertiary` for low-emphasis text actions
- Inputs
  - Use `.input` and `.select` with consistent height and focus ring
- Cards
  - Base: `.card` with border + subtle shadow
  - Hoverable: add `.cardHover` for lift on hover
- Chips / Tags
  - Base: `.chip` with `data-category` for taxonomy-aware styling
  - Active state: `.chip.active`

## Layout Patterns
- App shell
  - `SiteHeader` for global navigation + CTA
  - `SiteFooter` for multi-column enterprise footer
- Content
  - Hero sections: `.hero`, `.heroCopy`, `.heroMeta`
  - Filters: `.filterPanel`, `.filterRow`, `.chipGroup`
  - Two-panel layouts: `.kbLayout`, `.playgroundLayout`

## Do / Don't
- Do keep layouts clean with whitespace and clear hierarchy.
- Do emphasize approved content and ROI metrics.
- Do use taxonomy chips (sector/use_case/audience/funnel_stage/geography) for filtering.
- Don't introduce company names or logos.
- Don't add external links without prior approval.
- Don't add new UI libraries or frameworks.
