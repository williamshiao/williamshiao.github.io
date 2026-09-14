// Shared between FloatingShapes (the shape's own fill, while it's growing
// into/shrinking back from a panel — see beginExpand/beginShrink) and
// App.tsx (the real panel's background) so both land on the exact same
// color — anything else would put a visible seam between the shape's fill
// finishing its transition and the real panel taking over.
//
// color-mix blends toward whatever --color-surface currently resolves to,
// so the same mix percentage reads as a faint *light* tint in day mode and
// a faint *dark* tint in night mode without this needing to know which
// mode is active, or duplicate index.css's actual surface colors.
export function panelBackgroundTint(accentColor: string): string {
  return `color-mix(in srgb, ${accentColor} 10%, var(--color-surface))`;
}
