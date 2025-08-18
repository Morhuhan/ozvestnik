"use client"

import { useEffect, useMemo, useState } from "react"

type Section = { id: string; slug: string; name: string }

export function SectionPicker({ name, initial }: { name: string; initial?: Section | null }) {
  const [selected, setSelected] = useState<Section | null>(initial ?? null)
  const [open, setOpen] = useState(false)

  // поиск
  const [q, setQ] = useState("")
  const [qDeb, setQDeb] = useState("")
  const [list, setList] = useState<Section[]>([])
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
        const url = `/api/admin/sections${qDeb.trim() ? `?q=${encodeURIComponent(qDeb.trim())}` : ""}`
        const res = await fetch(url, { cache: "no-store" })
        const data = await res.json()
        if (!ignore) setList((data.items || []) as Section[])
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

  const choose = (s: Section) => setSelected(s)
  const clearAll = () => setSelected(null)

  // backend ждёт JSON: {id: "..."} или null
  const hiddenValue = useMemo(
    () => (selected ? JSON.stringify({ id: selected.id }) : "null"),
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
          disabled={!selected}
          className="text-xs underline opacity-80 disabled:opacity-40"
        >
          Очистить
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selected ? (
          <span className="px-2 py-1 border rounded text-sm">
            {selected.name} <span className="opacity-60">({selected.slug})</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="px-2 py-1 border rounded text-sm"
            aria-label="Выбрать раздел"
          >
            ＋
          </button>
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-xl shadow w-full max-w-lg p-4 space-y-4"
          >
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Выбрать раздел</div>
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
              placeholder="Поиск разделов"
              className="w-full border rounded p-2"
            />

            <div className="max-h-56 overflow-auto border rounded">
              {loading ? (
                <div className="p-3 text-sm opacity-60">Загрузка…</div>
              ) : list.length === 0 ? (
                <div className="p-3 text-sm opacity-60">Ничего не найдено</div>
              ) : (
                <ul>
                  {list.map((s) => {
                    const checked = selected?.id === s.id
                    return (
                      <li
                        key={s.id}
                        className="flex items-center justify-between p-2 border-b last:border-b-0"
                      >
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            checked={checked}
                            onChange={() => choose(s)}
                          />
                          <span>
                            {s.name} <span className="opacity-60">({s.slug})</span>
                          </span>
                        </label>
                        {!checked && (
                          <button
                            type="button"
                            onClick={() => choose(s)}
                            className="px-2 py-1 border rounded text-sm"
                          >
                            Выбрать
                          </button>
                        )}
                      </li>
                    )
                  })}
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
