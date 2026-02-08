[2026-02-09 Task 14] Accessibility Decisions

- Decision: Force white text for 'solid' variant buttons.
  - Context: In light mode, the default 'glass-text' (dark gray) had insufficient contrast on some primary/secondary colored backgrounds.
  - Rationale: Most brand/action colors (Blue, Purple, Green, Red) pair better with white text. Forced white ensures WCAG 2.1 AA compliance across all theme variations for solid-colored interactive elements.
- Decision: Use global keyboard listener in useContextMenu.ts.
  - Rationale: Context menus are often detached from the normal focus flow. A global listener for Escape and Arrows ensures accessibility regardless of where focus was when the menu opened.
