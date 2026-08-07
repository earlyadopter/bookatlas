"use client";

export function ThemeToggle() {
  const toggle = () => {
    const root = document.documentElement;
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    try {
      localStorage.setItem("tv_theme", next);
    } catch {}
  };
  return (
    <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme" title="Toggle theme">
      ◐
    </button>
  );
}
