"use client";

import { useSearchParams } from "next/navigation";

export default function HeaderSearch() {
  const sp = useSearchParams();
  const q = sp.get("q") ?? "";

  return (
    <form
      action="/search"
      method="GET"
      className="relative flex-1 max-w-xl hidden sm:flex"
      role="search"
      aria-label="Поиск по сайту"
    >
      <input
        type="text"
        name="q"
        defaultValue={q}
        placeholder="Искать статьи, теги, авторов…"
        className="w-full rounded-lg border px-3 py-2 pr-10 outline-none focus:ring-2 focus:ring-blue-500"
        autoComplete="off"
      />
      <button
        type="submit"
        aria-label="Искать"
        className="absolute right-1 top-1/2 -translate-y-1/2 rounded-md px-2 py-1 hover:bg-gray-100"
      >
        🔍
      </button>
    </form>
  );
}
