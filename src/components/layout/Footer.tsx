export function Footer() {
  return (
    <div className="fixed bottom-6 right-6 z-30 text-xs text-ink-soft/70 sm:bottom-10 sm:right-10">
      © {new Date().getFullYear()} William Shiao
    </div>
  );
}
