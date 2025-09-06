// app/(site)/components/SiteHeader.tsx

import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import HeaderSearch from "./HeaderSearch";

export default async function SiteHeader() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as string | undefined;
  const isStaff = role ? ["ADMIN", "EDITOR", "AUTHOR"].includes(role) : false;

  return (
    <header className="sticky top-0 z-50 bg-[#dfe7f0]/90 backdrop-blur supports-[backdrop-filter]:bg-[#dfe7f0]/70 shadow-sm">
      <div className="mx-auto flex max-w-[1720px] items-center gap-6 px-6 py-4 sm:px-8 lg:px-12">
        <Link
          href="/"
          className="-my-3 rounded-md px-3 py-3 text-2xl font-extrabold tracking-tight text-black no-underline hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30"
        >
          Озёрский вестник
        </Link>

        <HeaderSearch />

        <nav className="ml-auto flex items-center gap-1 text-base font-medium">
          <Link
            href="/"
            className="-my-3 rounded-md px-4 py-3 text-neutral-900 no-underline hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
          >
            Новости
          </Link>

          {userId ? (
            <>
              <Link
                href="/account"
                className="-my-3 rounded-md px-4 py-3 text-neutral-900 no-underline hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
              >
                Профиль
              </Link>

              <Link
                href={`/u/${encodeURIComponent(userId)}`}
                className="-my-3 rounded-md px-4 py-3 text-neutral-900 no-underline hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
              >
                Моя страница
              </Link>

              {isStaff && (
                <>
                  <Link
                    href="/admin"
                    className="-my-3 rounded-md px-4 py-3 text-neutral-900 no-underline hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
                  >
                    Админка
                  </Link>
                  <Link
                    href="/admin/articles"
                    className="-my-3 rounded-md px-4 py-3 text-neutral-900 no-underline hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
                  >
                    Статьи
                  </Link>
                </>
              )}

              <form action="/api/auth/signout" method="post">
                <input type="hidden" name="callbackUrl" value="/" />
                <button
                  type="submit"
                  className="-my-3 rounded-md px-4 py-3 text-neutral-900 no-underline hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
                >
                  Выйти
                </button>
              </form>
            </>
          ) : (
            <a
              href="/api/auth/signin"
              className="-my-3 rounded-md px-4 py-3 text-neutral-900 no-underline hover:bg-black/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/30 cursor-pointer"
            >
              Войти
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
