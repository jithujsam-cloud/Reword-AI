---
name: Sylvan Serenity
colors:
  surface: '#fbf9f6'
  surface-dim: '#dbdad7'
  surface-bright: '#fbf9f6'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f5f3f0'
  surface-container: '#efeeeb'
  surface-container-high: '#eae8e5'
  surface-container-highest: '#e4e2df'
  on-surface: '#1b1c1a'
  on-surface-variant: '#414844'
  inverse-surface: '#30312f'
  inverse-on-surface: '#f2f0ed'
  outline: '#717973'
  outline-variant: '#c1c8c2'
  surface-tint: '#3f6653'
  primary: '#012d1d'
  on-primary: '#ffffff'
  primary-container: '#1b4332'
  on-primary-container: '#86af99'
  inverse-primary: '#a5d0b9'
  secondary: '#4c6452'
  on-secondary: '#ffffff'
  secondary-container: '#cce6d0'
  on-secondary-container: '#506856'
  tertiary: '#401b1b'
  on-tertiary: '#ffffff'
  tertiary-container: '#5a302f'
  on-tertiary-container: '#d29895'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#c1ecd4'
  primary-fixed-dim: '#a5d0b9'
  on-primary-fixed: '#002114'
  on-primary-fixed-variant: '#274e3d'
  secondary-fixed: '#cee9d3'
  secondary-fixed-dim: '#b3cdb7'
  on-secondary-fixed: '#092012'
  on-secondary-fixed-variant: '#354c3b'
  tertiary-fixed: '#ffdad8'
  tertiary-fixed-dim: '#f5b7b4'
  on-tertiary-fixed: '#331111'
  on-tertiary-fixed-variant: '#673a39'
  background: '#fbf9f6'
  on-background: '#1b1c1a'
  surface-variant: '#e4e2df'
typography:
  headline-xl:
    fontFamily: literata
    fontSize: 64px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-xl-mobile:
    fontFamily: literata
    fontSize: 40px
    fontWeight: '700'
    lineHeight: '1.2'
  headline-lg:
    fontFamily: literata
    fontSize: 40px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-lg-mobile:
    fontFamily: literata
    fontSize: 32px
    fontWeight: '600'
    lineHeight: '1.2'
  headline-md:
    fontFamily: literata
    fontSize: 24px
    fontWeight: '600'
    lineHeight: '1.3'
  body-lg:
    fontFamily: literata
    fontSize: 20px
    fontWeight: '400'
    lineHeight: '1.6'
  body-md:
    fontFamily: literata
    fontSize: 16px
    fontWeight: '400'
    lineHeight: '1.6'
  label-md:
    fontFamily: inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: '1.0'
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  base: 8px
  container-max: 1280px
  gutter: 24px
  margin-desktop: 64px
  margin-mobile: 20px
---

## Brand & Style
The design system embodies a "Sylvan Modern" aesthetic—a sophisticated intersection of organic warmth and digital precision. It is designed for high-end editorial platforms, sustainable lifestyle brands, and boutique wellness applications. 

The visual language is rooted in **Minimalism** with a tactile, paper-like quality. By utilizing a high-contrast serif for both headings and body text, the system evokes the authority of traditional publishing while maintaining the breathability of modern web design. The experience should feel grounded, intentional, and intellectually stimulating.

## Colors
The palette is centered around a deep, scholarly Forest Green (`#1b4332`) that serves as the primary driver for call-to-actions and brand identity. This is balanced against an off-white, cream-toned background (`#fcfaf7`) to reduce eye strain and provide a softer, more organic "paper" feel than pure white.

- **Primary:** Forest Green, used for high-emphasis actions and navigation.
- **Secondary:** Soft Sage, used for subtle highlights or secondary backgrounds.
- **Neutral Background:** Off-white, the foundation of all pages.
- **Text:** Near-black green, ensuring high legibility while remaining softer than pure black.

## Typography
This design system utilizes **Literata** as the primary typeface for both headlines and body copy. Literata provides a modern, warm serif feel that is exceptionally readable at all sizes, offering a scholarly yet approachable character. 

To maintain functional clarity, **Inter** is used sparingly for labels, buttons, and small UI metadata. This sans-serif counterpoint ensures that interactive elements are clearly distinguished from editorial content. Headlines should use tighter letter spacing and bold weights to emphasize the "Modern Sylvan" personality.

## Layout & Spacing
The layout follows a **Fixed Grid** philosophy on desktop to preserve editorial line lengths, transitioning to a fluid model on smaller screens. 

- **Desktop:** 12-column grid with wide 64px margins to create a "frame" around the content.
- **Tablet:** 8-column grid with 32px margins.
- **Mobile:** 4-column grid with 20px margins.

Spacing is governed by an 8px linear scale. Generous vertical rhythm is encouraged; use large padding (80px+) between major sections to emphasize the minimal, airy aesthetic. Content should often be centered or asymmetrical to evoke a high-end magazine feel.

## Elevation & Depth
Depth is created through **Tonal Layers** rather than heavy shadows. In this design system, surfaces are distinguished by subtle shifts in color—moving from the off-white background to slightly lighter or darker sage containers.

Where physical separation is required, use **Ambient Shadows**: extremely soft, low-opacity shadows (2-4% opacity) with a slight green tint to match the primary color. This maintains the "flat" editorial feel while providing enough affordance for interactive elements like cards and dropdowns. Avoid heavy blurs or multiple stacked shadows.

## Shapes
Shapes are defined by **Rounded** corners (0.5rem base), which soften the traditional serif typography and create a more welcoming, organic feel. 

- **Buttons & Inputs:** Use the base `0.5rem` radius.
- **Cards & Containers:** Use `1rem` (Large) to create a soft, framing effect for content.
- **Image Masks:** Occasionally use `1.5rem` (XL) or soft organic "blob" shapes for featured photography to lean into the Sylvan theme.

## Components
- **Buttons:** Primary buttons use a solid Forest Green background with white Literata text. Secondary buttons use a Forest Green border with a transparent background. All buttons have a 0.5rem radius and significant horizontal padding.
- **Chips:** Small, pill-shaped tags using the Secondary Sage color for the background and Forest Green for the Inter-based label text.
- **Input Fields:** Minimalist design with a thin 1px border in a muted green-grey. On focus, the border thickens slightly and changes to the primary Forest Green.
- **Cards:** Cards should have no border, instead using a slightly lighter off-white fill or a very faint ambient shadow to separate them from the main background.
- **Lists:** Use custom Forest Green bullets or "check" icons. Maintain generous line height (1.6) for all list items to ensure readability.
- **Navigation:** A clean, top-aligned bar with text-based links in Literata Bold. Use the Forest Green for the active state or hover indicator.