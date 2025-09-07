// src/app/admin/users/page.tsx
export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import UsersTableClient from "./UsersTableClient";
import { prisma } from "../../../../lib/db";
import { getSessionUser } from "../../../../lib/session";

function getPageNumbers(page: number, total: number): (number | -1)[] {
  const max = 7;
  if (total <= max) return Array.from({ length: total }, (_, i) => i + 1);
  const res: (number | -1)[] = [];
  const pushRange = (a: number, b: number) => { for (let i = a; i <= b; i++) res.push(i); };
  res.push(1);
  const left = Math.max(2, page - 1);
  const right = Math.min(total - 1, page + 1);
  if (left > 2) res.push(-1);
  pushRange(left, right);
  if (right < total - 1) res.push(-1);
  res.push(total);
  while (res.length > max) {
    if (res[1] !== -1) res.splice(1, 1);
    else if (res[res.length - 2] !== -1) res.splice(res.length - 2, 1);
    else res.splice(2, res.length - 4, -1);
  }
  return res;
}

type SP = {
  page?: string;
  limit?: string;
  role?: string;     // ADMIN | EDITOR | AUTHOR | READER | ""
  banned?: string;   // "yes" | "no" | ""
  q?: string;        // поиск по имени/email
};

const ROLE_OPTS = ["", "ADMIN", "EDITOR", "AUTHOR", "READER"] as const;

export default async function AdminUsersPage({ searchParams }: { searchParams?: Promise<SP> }) {
  const sp = (await searchParams) ?? {};

  // only admins
  const s = await getSessionUser();
  if (!s?.id) notFound();
  const me = await prisma.user.findUnique({ where: { id: s.id }, select: { id: true, role: true } });
  if (me?.role !== "ADMIN") notFound();

  // filters
  const role = (sp.role || "").trim().toUpperCase();
  const banned = (sp.banned || "").trim();
  const qRaw = (sp.q || "").trim();
  const q = qRaw ? qRaw.slice(0, 200) : "";

  // pagination
  const PER_PAGE = [20, 50, 100] as const;
  const limitParsed = Number(sp.limit);
  const perPage = PER_PAGE.includes(limitParsed as any) ? (limitParsed as (typeof PER_PAGE)[number]) : 50;
  const pageParsed = Number(sp.page);
  const page = Number.isFinite(pageParsed) && pageParsed > 0 ? Math.floor(pageParsed) : 1;

  // where
  const whereAND: any[] = [];
  if (ROLE_OPTS.includes(role as any) && role) whereAND.push({ role });
  if (banned === "yes") whereAND.push({ OR: [{ isBanned: true }, { bannedUntil: { gt: new Date() } }] });
  if (banned === "no") whereAND.push({ AND: [{ isBanned: false }, { OR: [{ bannedUntil: null }, { bannedUntil: { lte: new Date() } }] }] });
  if (q) {
    whereAND.push({
      OR: [
        { name: { contains: q, mode: "insensitive" } },
        { email: { contains: q, mode: "insensitive" } },
      ],
    });
  }

  const where = whereAND.length ? { AND: whereAND } : {};

  const total = await prisma.user.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * perPage;

  const users = await prisma.user.findMany({
    where,
    orderBy: [{ createdAt: "desc" }],
    take: perPage,
    skip,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      image: true,
      createdAt: true,
      isBanned: true,
      bannedAt: true,
      bannedUntil: true,
      banReason: true,
    },
  });

  const initial = users.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role as "ADMIN" | "EDITOR" | "AUTHOR" | "READER",
    image: u.image || "/images/User_icon_2.svg",
    createdAt: u.createdAt.toISOString(),
    isBanned: !!u.isBanned || (u.bannedUntil ? u.bannedUntil > new Date() : false),
    bannedUntil: u.bannedUntil ? u.bannedUntil.toISOString() : null,
    banReason: u.banReason || "",
  }));

  const qs = (p: number, l: number = perPage) => {
    const sps = new URLSearchParams({
      ...(q ? { q } : {}),
      ...(role ? { role } : {}),
      ...(banned ? { banned } : {}),
      page: String(p),
      limit: String(l),
    });
    return `?${sps.toString()}`;
  };

  const pageNums = getPageNumbers(currentPage, totalPages);

  return (
    <main className="mx-auto w-full max-w-[1600px] px-6 sm:px-10 py-10">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-4xl font-extrabold tracking-tight text-neutral-900">Пользователи</h1>
      </div>

      {/* Фильтры + поиск */}
      <form
        className="rounded-2xl bg-neutral-50 p-6 ring-1 ring-neutral-200 shadow-sm mb-7 grid gap-4 md:grid-cols-6"
        method="get"
      >
        <div className="md:col-span-2">
          <label className="mb-1.5 block text-sm text-neutral-600">Поиск (имя или email)</label>
          <input
            name="q"
            defaultValue={q}
            placeholder="Например: Иван или ivan@example.com"
            className="w-full rounded-lg bg-white px-3 py-2.5 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-800 text-[15px]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-neutral-600">Роль</label>
          <select
            name="role"
            defaultValue={role}
            className="w-full rounded-lg bg-white px-3 py-2.5 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-800 text-[15px]"
          >
            <option value="">Все</option>
            <option value="ADMIN">ADMIN</option>
            <option value="EDITOR">EDITOR</option>
            <option value="AUTHOR">AUTHOR</option>
            <option value="READER">READER</option>
          </select>
        </div>

        <div>
          <label className="mb-1.5 block text-sm text-neutral-600">Статус</label>
          <select
            name="banned"
            defaultValue={banned}
            className="w-full rounded-lg bg-white px-3 py-2.5 ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-800 text-[15px]"
          >
            <option value="">Все</option>
            <option value="no">Активные</option>
            <option value="yes">Заблокированные</option>
          </select>
        </div>

        <div className="md:col-span-2 flex items-end justify-end gap-3">
          <button
            type="submit"
            className="rounded-lg bg-neutral-900 px-4 py-2.5 text-white hover:bg-neutral-800 text-[15px]"
          >
            Применить
          </button>
          {(q || role || banned) && (
            <a
              href="/admin/users"
              className="rounded-lg bg-white px-4 py-2.5 ring-1 ring-neutral-300 hover:bg-neutral-100 text-[15px]"
            >
              Сбросить
            </a>
          )}
        </div>
      </form>

      <UsersTableClient initial={initial} viewerId={me.id} />

      {/* Пагинация */}
      <div className="mt-9 flex flex-col-reverse items-stretch justify-between gap-5 sm:flex-row sm:items-center">
        <div className="text-[15px] text-neutral-600">
          Стр. {currentPage} из {totalPages} • всего {total}
        </div>

        <div className="flex items-center">
          <div className="mr-5 md:mr-7 flex items-center gap-3 text-[15px]">
            <span className="text-neutral-600">Показывать по:</span>
            <div className="flex overflow-hidden rounded-full ring-1 ring-neutral-300">
              {[20, 50, 100].map((n) => (
                <a
                  key={n}
                  href={qs(1, n)}
                  className={"px-4 py-2 " + (n === perPage ? "bg-neutral-900 text-white" : "bg-white hover:bg-neutral-100")}
                  aria-current={n === perPage ? "page" : undefined}
                >
                  {n}
                </a>
              ))}
            </div>
          </div>

          <nav className="flex items-center gap-1.5 text-[15px]">
            <a
              href={qs(Math.max(1, currentPage - 1))}
              aria-disabled={currentPage === 1}
              className={`rounded-full px-3.5 py-2 ring-1 ring-neutral-300 ${currentPage === 1 ? "pointer-events-none opacity-40" : "hover:bg-neutral-100"}`}
            >
              ←
            </a>

            {pageNums.map((n, i) =>
              n === -1 ? (
                <span key={`e${i}`} className="select-none px-2 text-neutral-500">…</span>
              ) : (
                <a
                  key={n}
                  href={qs(n)}
                  className={`rounded-full px-3.5 py-2 ring-1 ring-neutral-300 ${n === currentPage ? "bg-neutral-900 text-white ring-neutral-900" : "hover:bg-neutral-100"}`}
                  aria-current={n === currentPage ? "page" : undefined}
                >
                  {n}
                </a>
              )
            )}

            <a
              href={qs(Math.min(totalPages, currentPage + 1))}
              aria-disabled={currentPage === totalPages}
              className={`rounded-full px-3.5 py-2 ring-1 ring-neutral-300 ${currentPage === totalPages ? "pointer-events-none opacity-40" : "hover:bg-neutral-100"}`}
            >
              →
            </a>
          </nav>
        </div>
      </div>
    </main>
  );
}
