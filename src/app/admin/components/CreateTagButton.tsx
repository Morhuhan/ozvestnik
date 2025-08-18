"use client"

import { useToast } from "@/app/components/toast/ToastProvider"
import { useState } from "react"
import { TitleSlugSimple } from "./TitleSlugSimple";

export function CreateTagButton({
  onCreated,
}: {
  onCreated?: (tag: { id: string; name: string; slug: string }) => void
}) {
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [name, setName] = useState("")
  const [slug, setSlug] = useState("")

  async function create() {
    if (!name.trim() || !slug.trim()) {
      toast({ type: "error", title: "Укажите название и slug" })
      return
    }
    setLoading(true)
    try {
      const res = await fetch("/api/admin/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        toast({ type: "error", title: data.error || "Ошибка создания тега" })
        return
      }
      toast({ type: "success", title: "Тег создан" })
      onCreated?.(data.tag)
      setOpen(false)
      setName(""); setSlug("")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button type="button" className="text-sm underline" onClick={() => setOpen(true)}>
        Создать тег
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow w-full max-w-md p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Новый тег</div>
              <button type="button" onClick={() => setOpen(false)} className="text-xl leading-none">×</button>
            </div>

            <TitleSlugSimple
              titleName="__ignoreTitle"
              slugName="__ignoreSlug"
              disableNames
              requireSlug
              onValues={({ title, slug }) => { setName(title); setSlug(slug) }}
            />

            <div className="flex gap-2 justify-end">
              <button type="button" className="px-3 py-2 rounded border" onClick={() => setOpen(false)}>Отмена</button>
              <button type="button" className="px-3 py-2 rounded bg-black text-white disabled:opacity-50" disabled={loading} onClick={create}>
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
