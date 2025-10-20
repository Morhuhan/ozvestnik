import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/auth";
import HeaderSearch from "./HeaderSearch";
import AdminMenu from "./AdminMenu";
import AuthLauncherButton from "./AuthLauncherButton";
import MobileMenu from "./MobileMenu";
import AllNewsList from "./AllNewsList";

export default async function SiteHeader() {
  const session = await getServerSession(authOptions);
  const user = session?.user as any | undefined;
  const userId = user?.id as string | undefined;
  const role = user?.role as ("ADMIN" | "EDITOR" | "AUTHOR" | "READER" | undefined);
  const isStaff = role ? ["ADMIN", "EDITOR", "AUTHOR"].includes(role) : false;
  const isAdmin = role === "ADMIN";
  const appId = Number(process.env.AUTH_VK_ID || 0);

  return (
    <header className="sticky top-0 z-50 bg-[#dfe7f0]/90 backdrop-blur supports-[backdrop-filter]:bg-[#dfe7f0]/70 shadow-sm">
      <div className="mx-auto max-w-[1720px] px-4 sm:px-6 lg:px-12">
        <div className="flex items-center gap-3 py-3 md:py-4">
          <div className="flex w-full items-center md:hidden">
            <MobileMenu isStaff={isStaff} isAdmin={isAdmin} userId={userId}>
              <AllNewsList limit={12} className="mt-1" inMobileMenu />
            </MobileMenu>
            <Link href="/" className="mx-auto text-lg font-extrabold tracking-tight text-black no-underline">
              Озёрский вестник
            </Link>
            <div className="ml-auto">
              {userId ? (
                <form action="/api/auth/signout" method="post">
                  <input type="hidden" name="callbackUrl" value="/" />
                  <button type="submit" className="rounded-md px-3 py-2 text-sm font-medium text-neutral-900 hover:bg-black/10">
                    Выйти
                  </button>
                </form>
              ) : (
                <AuthLauncherButton appId={appId} />
              )}
            </div>
          </div>

          <Link href="/" className="-my-3 hidden rounded-md px-3 py-3 text-2xl font-extrabold tracking-tight text-black no-underline hover:bg-black/10 md:inline-block">
            Озёрский вестник
          </Link>

          <div className="hidden flex-1 md:block">
            <HeaderSearch />
          </div>

          <nav className="ml-auto hidden items-center gap-1 text-base font-medium md:flex">
            {userId && isStaff && <AdminMenu isAdmin={isAdmin} />}
            <Link href="/" className="-my-3 rounded-md px-4 py-3 text-neutral-900 no-underline hover:bg-black/10">
              Новости
            </Link>
            {userId ? (
              <>
                <Link href="/account" className="-my-3 rounded-md px-4 py-3 text-neutral-900 no-underline hover:bg-black/10">
                  Профиль
                </Link>
                <form action="/api/auth/signout" method="post">
                  <input type="hidden" name="callbackUrl" value="/" />
                  <button type="submit" className="-my-3 rounded-md px-4 py-3 text-neutral-900 hover:bg-black/10">
                    Выйти
                  </button>
                </form>
              </>
            ) : (
              <AuthLauncherButton appId={appId} />
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}
