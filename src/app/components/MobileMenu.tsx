"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";

type Props = {
  isStaff: boolean;
  isAdmin: boolean;
  userId?: string;
  children?: React.ReactNode;
};

export default function MobileMenu({ isStaff, isAdmin, userId, children }: Props) {
  const [mounted, setMounted] = useState(false);
  const [render, setRender] = useState(false);
  const [open, setOpen] = useState(false);

  const [adminOpen, setAdminOpen] = useState(false);

  const portalEl = useRef<Element | null>(null);
  const router = useRouter();

  useEffect(() => {
    portalEl.current = document.getElementById("modal-root");
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!render) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKey);
    document.documentElement.classList.add("overflow-hidden");

    return () => {
      document.removeEventListener("keydown", onKey);
      document.documentElement.classList.remove("overflow-hidden");
    };
  }, [render]);

  useEffect(() => {
    if (!render && open) setRender(true);

    if (!open && render) {
      const t = setTimeout(() => setRender(false), 300);
      return () => clearTimeout(t);
    }
  }, [open, render]);

  const show = useCallback(() => {
    setRender(true);
    requestAnimationFrame(() => setOpen(true));
  }, []);

  const close = useCallback(() => setOpen(false), []);

  function onSearchSubmit(formData: FormData) {
    const q = String(formData.get("q") || "").trim();
    if (q.length > 0) {
      router.push(`/search?q=${encodeURIComponent(q)}`);
      setOpen(false);
    }
  }

  const portal = useMemo(() => {
    if (!mounted || !portalEl.current || !render) return null;

    return createPortal(
      <div className="fixed inset-0 z-[70]">
        <div
          onClick={close}
          className={`fixed inset-0 bg-transparent backdrop-blur-sm transition-opacity duration-300 ${
            open ? "opacity-100" : "opacity-0"
          }`}
        />

        <div
          className={`fixed inset-y-0 left-0 z-[71] h-full w-[70%] max-w-xs overflow-y-auto bg-white shadow-xl ring-1 ring-black/5 transition-transform duration-300 ${
            open ? "translate-x-0" : "-translate-x-full"
          }`}
          onClick={(e) => {
            const el = (e.target as HTMLElement).closest('[data-close-menu="true"]');
            if (el) setOpen(false);
          }}
        >
          <div className="flex items-center justify-end px-3 py-2">
            <button onClick={close} aria-label="Закрыть меню" className="rounded-md p-2 hover:bg-black/10">
              <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M6 6l12 12M18 6l-12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <nav className="flex flex-col gap-0.5 px-2 pb-2">

            {userId && isStaff && (
              <div className="flex flex-col">
                <button
                  type="button"
                  onClick={() => setAdminOpen((v) => !v)}
                  className="flex items-center justify-between rounded-md px-3 py-2 text-base font-medium text-neutral-900 hover:bg-black/10"
                >
                  Админка
                  <span className={`transition-transform ${adminOpen ? "rotate-180" : ""}`}>
                    ▾
                  </span>
                </button>

                {adminOpen && (
                  <div className="ml-4 mt-1 flex flex-col gap-0.5">
                    <Link
                      href="/admin/articles"
                      data-close-menu="true"
                      className="rounded-md px-3 py-2 text-base text-neutral-900 hover:bg-black/10"
                    >
                      Статьи
                    </Link>
                    <Link
                      href="/admin/media"
                      data-close-menu="true"
                      className="rounded-md px-3 py-2 text-base text-neutral-900 hover:bg-black/10"
                    >
                      Медиа-библиотека
                    </Link>

                    {isAdmin && (
                      <Link
                        href="/admin/users"
                        data-close-menu="true"
                        className="rounded-md px-3 py-2 text-base text-neutral-900 hover:bg-black/10"
                      >
                        Пользователи
                      </Link>
                    )}

                    {isAdmin && (
                      <Link
                        href="/admin/logs"
                        data-close-menu="true"
                        className="rounded-md px-3 py-2 text-base text-neutral-900 hover:bg-black/10"
                      >
                        Журнал событий
                      </Link>
                    )}
                  </div>
                )}
              </div>
            )}

            <Link
              href="/"
              data-close-menu="true"
              className="rounded-md px-3 py-2 text-base font-medium text-neutral-900 hover:bg-black/10"
            >
              Новости
            </Link>

            {userId && (
              <Link
                href="/account"
                data-close-menu="true"
                className="rounded-md px-3 py-2 text-base font-medium text-neutral-900 hover:bg-black/10"
              >
                Профиль
              </Link>
            )}

            <Link
              href="/search"
              data-close-menu="true"
              className="rounded-md px-3 py-2 text-base font-medium text-neutral-900 hover:bg-black/10"
            >
              Поиск
            </Link>
          </nav>

          <div className="px-4 pb-3 pt-1">
            <form action={onSearchSubmit} className="flex items-center gap-2">
              <input
                type="text"
                name="q"
                placeholder="Поиск статей"
                className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-neutral-900 px-3 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Искать
              </button>
            </form>
          </div>

          <div className="px-3 pb-5">{children}</div>
        </div>
      </div>,
      portalEl.current
    );
  }, [mounted, portalEl, render, open, close, adminOpen, children]);

  return (
    <>
      <button
        aria-label="Открыть меню"
        onClick={show}
        className="rounded-md p-2 hover:bg-black/10"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
      </button>
      {portal}
    </>
  );
}
