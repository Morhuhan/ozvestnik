// src/app/admin/users/UsersTableClient.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Role = "ADMIN" | "EDITOR" | "AUTHOR" | "READER";

type Row = {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  image: string | null;
  createdAt: string; // ISO
  isBanned: boolean;
  bannedUntil: string | null; // ISO
  banReason: string;
};

export default function UsersTableClient({
  initial,
  viewerId,
}: {
  initial: Row[];
  viewerId: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  function fmt(iso: string) {
    const d = new Date(iso);
    return d.toLocaleString("ru-RU", { dateStyle: "medium", timeStyle: "short" });
  }

  function StatusBadge({ isBanned, until }: { isBanned: boolean; until: string | null }) {
    const base =
      "inline-flex items-center px-2.5 py-1.5 text-sm font-medium rounded-md border";
    if (!isBanned) {
      return (
        <span className={`${base} bg-emerald-50 text-emerald-800 border-emerald-200`}>
          Активен
        </span>
      );
    }
    return (
      <span className={`${base} bg-red-50 text-red-800 border-red-200`}>
        Заблокирован{until ? ` до ${new Date(until).toLocaleString("ru-RU")}` : ""}
      </span>
    );
  }

  async function changeRole(id: string, nextRole: Role) {
    if (!confirm(`Сменить роль на ${nextRole}?`)) return;
    try {
      setBusyId(id);
      const res = await fetch(`/api/admin/users/${id}/role`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: nextRole }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Не удалось сменить роль");
      setRows((prev) => prev.map((r) => (r.id === id ? { ...r, role: nextRole } : r)));
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  async function banUser(id: string) {
    const daysStr = window.prompt("На сколько дней заблокировать? (по умолчанию 30)", "30");
    if (daysStr === null) return;
    const days = Number(daysStr);
    if (!Number.isFinite(days) || days <= 0) {
      alert("Неверное число дней.");
      return;
    }
    const reason =
      window.prompt("Причина блокировки (необязательно)", "Модерация: нарушение правил") ||
      undefined;

    try {
      setBusyId(id);
      const res = await fetch("/api/mod/ban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id, days, reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Не удалось заблокировать");
      const untilISO: string | null = data?.until ?? null;
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, isBanned: true, bannedUntil: untilISO ?? null } : r
        )
      );
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  async function unbanUser(id: string) {
    if (!confirm("Снять блокировку?")) return;
    try {
      setBusyId(id);
      const res = await fetch("/api/mod/unban", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.message || "Не удалось разбанить");
      setRows((prev) =>
        prev.map((r) =>
          r.id === id ? { ...r, isBanned: false, bannedUntil: null, banReason: "" } : r
        )
      );
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Ошибка");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="w-full overflow-x-auto rounded-2xl ring-1 ring-neutral-200 bg-white shadow-sm">
      <table className="w-full min-w-[1200px] border-separate border-spacing-0 table-auto">
        <thead>
          <tr className="bg-neutral-50 text-left text-sm text-neutral-700">
            <th className="px-6 py-5 font-semibold">Пользователь</th>
            <th className="px-6 py-5 font-semibold">Email</th>
            <th className="px-6 py-5 font-semibold">Роль</th>
            <th className="px-6 py-5 font-semibold">Статус</th>
            <th className="px-6 py-5 font-semibold">Создан</th>
            <th className="px-6 py-5 font-semibold text-right">Действия</th>
          </tr>
        </thead>
        <tbody className="text-[15px] text-neutral-900">
          {rows.map((u, idx) => (
            <tr key={u.id} className={idx % 2 ? "bg-white" : "bg-neutral-50/40"}>
              <td className="px-6 py-5 align-middle">
                <div className="flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={u.image || "/images/User_icon_2.svg"}
                    alt=""
                    className="h-12 w-12 rounded-full ring-1 ring-neutral-300 object-cover"
                  />
                  <div className="min-w-0">
                    <a
                      className="block truncate font-semibold text-[16px] leading-6 text-neutral-900 hover:underline"
                      href={`/u/${u.id}`}
                      title={u.name || "Пользователь"}
                    >
                      {u.name || "Пользователь"}
                    </a>
                    {/* УДАЛЕНО: вывод ID пользователя */}
                  </div>
                </div>
              </td>

              <td className="px-6 py-5 align-middle text-[15px] text-neutral-800 break-all">
                {u.email || "—"}
              </td>

              {/* РОЛЬ — только выпадающий список */}
              <td className="px-6 py-5 align-middle">
                <select
                  value={u.role}
                  onChange={(e) => changeRole(u.id, e.target.value as Role)}
                  disabled={busyId === u.id || u.id === viewerId}
                  className="rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-neutral-800 disabled:opacity-50"
                  title={u.id === viewerId ? "Нельзя менять свою роль здесь" : "Сменить роль"}
                >
                  <option value="ADMIN">ADMIN</option>
                  <option value="EDITOR">EDITOR</option>
                  <option value="AUTHOR">AUTHOR</option>
                  <option value="READER">READER</option>
                </select>
              </td>

              {/* СТАТУС — прямоугольные бейджи */}
              <td className="px-6 py-5 align-middle">
                <StatusBadge isBanned={u.isBanned} until={u.bannedUntil} />
              </td>

              <td className="px-6 py-5 align-middle text-[15px] text-neutral-800 whitespace-nowrap">
                {fmt(u.createdAt)}
              </td>

              <td className="px-6 py-5 align-middle">
                <div className="flex items-center justify-end gap-3">
                  {!u.isBanned ? (
                    <button
                      onClick={() => banUser(u.id)}
                      disabled={busyId === u.id || u.id === viewerId}
                      className="inline-flex h-10 items-center rounded-md bg-red-600 px-4 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                      title={u.id === viewerId ? "Нельзя забанить самого себя" : "Заблокировать пользователя"}
                    >
                      {busyId === u.id ? "…" : "Забанить"}
                    </button>
                  ) : (
                    <button
                      onClick={() => unbanUser(u.id)}
                      disabled={busyId === u.id}
                      className="inline-flex h-10 items-center rounded-md bg-green-600 px-4 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
                    >
                      {busyId === u.id ? "…" : "Разбанить"}
                    </button>
                  )}
                  {/* УДАЛЕНО: кнопка "Профиль" */}
                </div>
              </td>
            </tr>
          ))}

          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="px-6 py-10 text-center text-[15px] text-neutral-600">
                Пользователи не найдены.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
