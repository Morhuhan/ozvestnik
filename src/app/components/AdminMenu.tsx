"use client";

import Link from "next/link";
import { useState, useCallback } from "react";

export default function AdminMenu({ isAdmin }: { isAdmin: boolean }) {
  const [open, setOpen] = useState(false);

  const toggle = () => setOpen((v) => !v);
  const close = useCallback(() => setOpen(false), []);

  const item =
    "block rounded-lg px-3 py-2 text-sm text-neutral-900 hover:bg-neutral-100";

  return (
    <div className="relative">
      <button
        type="button"
        onClick={toggle}
        className="-my-2 cursor-pointer select-none rounded-xl px-4 py-2.5 font-semibold text-white bg-neutral-900 hover:bg-neutral-800 ring-1 ring-neutral-900/80 shadow-sm flex items-center gap-2"
      >
        <span>Админка</span>
        <span
          aria-hidden
          className={`transition-transform duration-150 ${
            open ? "rotate-180" : ""
          }`}
        >
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-64 rounded-xl bg-white p-2 ring-1 ring-black/10 shadow-xl z-50">
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
      )}
    </div>
  );
}
