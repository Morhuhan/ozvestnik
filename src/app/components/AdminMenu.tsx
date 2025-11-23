// app/(site)/components/AdminMenu.tsx
"use client";

import Link from "next/link";
import { useCallback, useRef } from "react";

export default function AdminMenu({ isAdmin }: { isAdmin: boolean }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = useCallback(() => {
    ref.current?.removeAttribute("open");
  }, []);

  const item =
    "block rounded-lg px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-100";

  return (
    <details ref={ref} className="relative group">
      <summary
        className="-my-2 list-none cursor-pointer select-none rounded-xl px-4 py-2.5 font-semibold text-white bg-neutral-900 hover:bg-neutral-800 ring-1 ring-neutral-900/80 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 flex items-center gap-2"
      >
        <span>Админка</span>
        <span
          aria-hidden
          className="transition-transform duration-150 group-open:rotate-180"
        >
          ▾
        </span>
      </summary>

      <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white p-2 ring-1 ring-black/10 shadow-xl">
        <Link href="/admin/articles" className={item} onClick={close}>
          Статьи
        </Link>
        <Link href="/admin/media" className={item} onClick={close}>
          Медиа-библиотека
        </Link>
        {isAdmin && (
          <Link href="/admin/users" className={item} onClick={close}>
            Пользователи
          </Link>
        )}
        {isAdmin && (
          <Link href="/admin/logs" className={item} onClick={close}>
            Журнал событий
          </Link>
        )}
      </div>
    </details>
  );
}
