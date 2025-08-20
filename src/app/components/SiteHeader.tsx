// src/app/components/SiteHeader.tsx
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";

export default async function SiteHeader() {
  const session = await getServerSession(authOptions);
  const userId = (session?.user as any)?.id as string | undefined;
  const role = (session?.user as any)?.role as string | undefined;
  const isStaff = role ? ["ADMIN", "EDITOR", "AUTHOR"].includes(role) : false;

  return (
    <header className="border-b sticky top-0 bg-white/90 backdrop-blur supports-[backdrop-filter]:bg-white/60 z-50">
      <div className="container mx-auto p-4 flex items-center justify-between">
        <Link href="/" className="font-semibold">
          Озёрский вестник
        </Link>

        <nav className="text-sm flex items-center gap-4">
          <Link className="underline" href="/">
            Новости
          </Link>

          {userId ? (
            <>
              <Link className="underline" href="/account">
                Профиль
              </Link>
              <Link className="underline" href={`/u/${encodeURIComponent(userId)}`}>
                Моя страница
              </Link>

              {isStaff && (
                <>
                  <Link className="underline" href="/admin">
                    Админка
                  </Link>
                  <Link className="underline" href="/admin/articles">
                    Статьи
                  </Link>
                </>
              )}

              {/* Правильный signout: POST на /api/auth/signout */}
              <form action="/api/auth/signout" method="post">
                {/* Можно указать куда вернуть после выхода */}
                <input type="hidden" name="callbackUrl" value="/" />
                <button type="submit" className="underline">
                  Выйти
                </button>
              </form>
            </>
          ) : (
            // Signin можно оставить простой ссылкой
            <a className="underline" href="/api/auth/signin">
              Войти
            </a>
          )}
        </nav>
      </div>
    </header>
  );
}
