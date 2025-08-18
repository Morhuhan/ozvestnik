"use client"

import { useEffect, useMemo, useState } from "react"

type Tag = { id: string; slug: string; name: string }

export function TagPicker({ name, initial }: { name: string; initial?: Tag[] }) {
  const [selected, setSelected] = useState<Tag[]>(initial ?? [])
  const [open, setOpen] = useState(false)

  // поиск
  const [q, setQ] = useState("")
  const [qDeb, setQDeb] = useState("")
  const [list, setList] = useState<Tag[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => setQDeb(q), 250)
    return () => clearTimeout(id)
  }, [q])

  useEffect(() => {
    if (!open) return
    let ignore = false
    ;(async () => {
      setLoading(true)
      try {
        const url = `/api/admin/tags${qDeb.trim() ? `?q=${encodeURIComponent(qDeb.trim())}` : ""}`
        const res = await fetch(url, { cache: "no-store" })
        const data = await res.json()
        if (!ignore) setList((data.items || []) as Tag[])
      } catch {
        if (!ignore) setList([])
      } finally {
        if (!ignore) setLoading(false)
      }
    })()
    return () => {
      ignore = true
    }
  }, [qDeb, open])

  const isChecked = (id: string) => selected.some((s) => s.id === id)
  const toggle = (t: Tag) =>
    setSelected((prev) => (isChecked(t.id) ? prev.filter((x) => x.id !== t.id) : [...prev, t]))
  const remove = (id: string) => setSelected((prev) => prev.filter((t) => t.id !== id))
  const clearAll = () => setSelected([])

  // отправляем JSON
  const hiddenValue = useMemo(
    () => JSON.stringify(selected.map((t) => ({ id: t.id }))),
    [selected]
  )

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={hiddenValue} />

      <div className="flex items-center justify-between">
        <div className="text-xs opacity-60" />
        <button
          type="button"
          onClick={clearAll}
          disabled={selected.length === 0}
          className="text-xs underline opacity-80 disabled:opacity-40"
        >
          Очистить
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selected.length > 0 &&
          selected.map((t) => (
            <span
              key={t.id}
              className="px-2 py-1 border rounded text-sm inline-flex items-center gap-2"
            >
              {t.name} <span className="opacity-60">({t.slug})</span>
              <button
                type="button"
                onClick={() => remove(t.id)}
                className="opacity-60 hover:opacity-100"
              >
                ×
              </button>
            </span>
          ))}
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="px-2 py-1 border rounded text-sm"
          aria-label="Добавить теги"
        >
          ＋
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-xl shadow w-full max-w-lg p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Выбрать теги</div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-xl leading-none"
              >
                ×
              </button>
            </div>

            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск тегов"
              className="w-full border rounded p-2"
            />

            <div className="max-h-56 overflow-auto border rounded">
              {loading ? (
                <div className="p-3 text-sm opacity-60">Загрузка…</div>
              ) : list.length === 0 ? (
                <div className="p-3 text-sm opacity-60">Ничего не найдено</div>
              ) : (
                <ul>
                  {list.map((t) => (
                    <li
                      key={t.id}
                      className="flex items-center justify-between p-2 border-b last:border-b-0"
                    >
                      <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isChecked(t.id)}
                          onChange={() => toggle(t)}
                        />
                        <span>
                          {t.name} <span className="opacity-60">({t.slug})</span>
                        </span>
                      </label>
                      {!isChecked(t.id) && (
                        <button
                          type="button"
                          onClick={() => toggle(t)}
                          className="px-2 py-1 border rounded text-sm"
                        >
                          Добавить
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                className="px-3 py-2 rounded border"
                onClick={() => setOpen(false)}
              >
                Готово
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
