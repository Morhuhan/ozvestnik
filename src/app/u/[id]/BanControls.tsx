// src/app/u/[id]/BanControls.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BanControls({
  userId,
  initial,
}: {
  userId: string;
  initial: { isBanned: boolean; reason: string; untilISO: string | null };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(initial.reason || "");
  const [until, setUntil] = useState<string | null>(
    initial.untilISO ? toLocalDatetime(initial.untilISO) : null
  );
  const [busy, setBusy] = useState(false);

  async function ban() {
    setBusy(true);
    try {
      const res = await fetch(`/api/mod/ban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          reason: reason || null,
          until: until ? new Date(until).toISOString() : null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || "Не удалось забанить");
      }
      setOpen(false);
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  async function unban() {
    if (!confirm("Снять блокировку?")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/mod/unban`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d?.message || "Не удалось разбанить");
      }
      router.refresh();
    } catch (e: any) {
      alert(e.message || "Ошибка");
    } finally {
      setBusy(false);
    }
  }

  return initial.isBanned ? (
    <button
      onClick={unban}
      disabled={busy}
      className="inline-flex h-9 items-center rounded-md bg-green-700 px-3 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-60"
    >
      Разбанить
    </button>
  ) : (
    <div className="relative">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="inline-flex h-9 items-center rounded-md bg-red-700 px-3 text-sm font-medium text-white hover:bg-red-800"
        >
          Забанить
        </button>
      ) : (
        <div className="z-10 w-[320px] rounded-xl bg-white p-3 text-sm ring-1 ring-black/10 shadow-xl">
          <div className="mb-2 font-medium">Блокировка пользователя</div>
          <label className="block text-xs text-neutral-600 mb-1">Причина</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="mb-2 w-full rounded border border-neutral-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-600"
            placeholder="Нарушение правил…"
          />
          <label className="block text-xs text-neutral-600 mb-1">До (необязательно)</label>
          <input
            type="datetime-local"
            value={until ?? ""}
            onChange={(e) => setUntil(e.target.value || null)}
            className="mb-3 w-full rounded border border-neutral-300 p-2 text-sm outline-none focus:ring-2 focus:ring-blue-600"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={ban}
              disabled={busy}
              className="inline-flex h-9 items-center rounded-md bg-red-700 px-3 text-sm font-medium text-white hover:bg-red-800 disabled:opacity-60"
            >
              Подтвердить
            </button>
            <button
              onClick={() => setOpen(false)}
              className="h-9 rounded-md px-3 text-sm text-neutral-700 hover:bg-neutral-100"
            >
              Отмена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function toLocalDatetime(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}
