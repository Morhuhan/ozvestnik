"use client"

import { useToast } from "@/app/components/toast/ToastProvider"
import { useMemo, useState } from "react"
import { TitleSlugSimple } from "./TitleSlugSimple";

export function CreateAuthorButton({
  onCreated,
}: {
  onCreated?: (a: { id: string; slug: string; lastName: string; firstName: string; patronymic: string }) => void
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [ln, setLn] = useState("")
  const [fn, setFn] = useState("")
  const [pt, setPt] = useState("")
  const [slug, setSlug] = useState("")
  const [loading, setLoading] = useState(false)

  // источник для генерации slug — ФИО
  const fio = useMemo(() => [ln, fn, pt].filter(Boolean).join(" "), [ln, fn, pt])
  const canCreate = ln.trim() && fn.trim() && pt.trim() && slug.trim()

  async function create() {
    if (!canCreate) {
      toast({ type: "error", title: "Укажите ФИО и slug" })
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/admin/authors", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          lastName: ln.trim(),
          firstName: fn.trim(),
          patronymic: pt.trim(),
          slug: slug.trim(),
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ type: "error", title: data.error || "Ошибка создания автора" })
        return
      }
      toast({ type: "success", title: "Автор создан" })
      onCreated?.(data.author)
      setOpen(false)
      setLn(""); setFn(""); setPt(""); setSlug("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button type="button" className="text-sm underline" onClick={() => setOpen(true)}>
        Создать автора
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow w-full max-w-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Новый автор</div>
              <button type="button" onClick={() => setOpen(false)} className="text-xl leading-none">×</button>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <input className="border rounded p-2" placeholder="Фамилия *" value={ln} onChange={(e) => setLn(e.target.value)} />
              <input className="border rounded p-2" placeholder="Имя *" value={fn} onChange={(e) => setFn(e.target.value)} />
              <input className="border rounded p-2" placeholder="Отчество *" value={pt} onChange={(e) => setPt(e.target.value)} />
            </div>

            <TitleSlugSimple
              hideTitle
              titleValue={fio}           // ← отсюда берём значение для генерации slug
              slugName="__ignoreSlug"    // ← имя не нужно (используем локальный стейт)
              disableNames
              requireSlug
              onValues={({ slug }) => setSlug(slug)}
            />

            <div className="flex gap-2 justify-end">
              <button type="button" className="px-3 py-2 rounded border" onClick={() => setOpen(false)}>Отмена</button>
              <button
                type="button"
                className="px-3 py-2 rounded bg-black text-white disabled:opacity-50"
                disabled={!canCreate || loading}
                onClick={create}
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
