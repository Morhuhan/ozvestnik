"use client";

export default function HeaderSearch() {
  return (
    <form
      action="/search"
      method="GET"
      className="relative hidden max-w-xl flex-1 sm:flex"
      role="search"
      aria-label="Поиск по названию"
    >
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500">🔍</span>

      <input
        type="text"
        name="q"
        placeholder="Искать по названию…"
        className="w-full rounded-full bg-neutral-100 pl-9 pr-20 py-2 ring-1 ring-neutral-200 transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-neutral-600"
        autoComplete="off"
      />

      <button
        type="submit"
        aria-label="Искать"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-sm text-neutral-800 z-10 pointer-events-auto transition-colors ring-1 ring-transparent hover:bg-neutral-100 hover:ring-neutral-300"
      >
        Найти
      </button>
    </form>
  );
}
