export function Footer() {
  return (
    <footer className="border-t border-line px-6 py-10 text-center text-sm text-ink-soft">
      <p>
        {/* TODO(content): confirm contact links (email, LinkedIn, GitHub) */}
        © {new Date().getFullYear()} William Shiao
      </p>
    </footer>
  );
}
