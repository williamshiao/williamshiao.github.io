export function Footer() {
  return (
    <div className="absolute bottom-6 right-6 z-20 text-xs text-ink-soft/70 sm:bottom-10 sm:right-10">
      {/* TODO(content): confirm contact links (email, LinkedIn, GitHub) */}
      © {new Date().getFullYear()} William Shiao
    </div>
  );
}
