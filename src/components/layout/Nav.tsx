const NAV_ITEMS = [
  { href: "#about", label: "About" },
  { href: "#artworks", label: "Artworks" },
  { href: "#internships", label: "Internships" },
] as const;

/**
 * Site nav. Each link carries `data-blob-target` — the hook the cursor-blob
 * component (built in a later step) will query to know which elements it
 * should mold itself around on hover.
 */
export function Nav() {
  return (
    <header className="sticky top-0 z-40 border-b border-line/70 bg-canvas/80 backdrop-blur-sm">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <a
          href="#top"
          data-blob-target
          className="font-display text-lg font-semibold tracking-tight text-ink"
        >
          William Shiao
        </a>
        <nav>
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <a
                  href={item.href}
                  data-blob-target
                  className="inline-block rounded-full px-4 py-2 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
                >
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </header>
  );
}
