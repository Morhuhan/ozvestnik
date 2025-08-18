// src/app/admin/articles/components/AuthorPicker.tsx
"use client"

import { useEffect, useMemo, useState } from "react"

type Author = { id: string; slug: string; lastName: string; firstName: string; patronymic: string }
const fio = (a: Author | Pick<Author,"lastName"|"firstName"|"patronymic">) => [a.lastName, a.firstName, a.patronymic].join(" ")

export function AuthorPicker({ name, initial }: { name: string; initial?: Author[] }) {
  const [selected, setSelected] = useState<Author[]>(initial ?? [])
  const [open, setOpen] = useState(false)

  const [q, setQ] = useState("")
  const [qDeb, setQDeb] = useState("")
  const [list, setList] = useState<Author[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { const id = setTimeout(() => setQDeb(q), 250); return () => clearTimeout(id) }, [q])

  useEffect(() => {
    if (!open) return
    let ignore = false
    ;(async () => {
      setLoading(true)
      try {
        const url = `/api/admin/authors${qDeb.trim() ? `?q=${encodeURIComponent(qDeb.trim())}` : ""}`
        const res = await fetch(url, { cache: "no-store" })
        const data = await res.json()
        if (!ignore) setList((data.items || []) as Author[])
      } catch { if (!ignore) setList([]) }
      finally { if (!ignore) setLoading(false) }
    })()
    return () => { ignore = true }
  }, [qDeb, open])

  const isChecked = (id: string) => selected.some(s => s.id === id)
  const toggle = (a: Author) => setSelected(prev => isChecked(a.id) ? prev.filter(x => x.id !== a.id) : [...prev, a])
  const remove = (id: string) => setSelected(prev => prev.filter(a => a.id !== id))
  const clearAll = () => setSelected([])

  const hiddenValue = useMemo(() => JSON.stringify(selected.map(a => ({ id: a.id }))), [selected])

  return (
    <div className="space-y-2">
      <input type="hidden" name={name} value={hiddenValue} />

      <div className="flex items-center justify-between">
        <div className="text-xs opacity-60" />
        <button type="button" onClick={clearAll} disabled={selected.length===0} className="text-xs underline opacity-80 disabled:opacity-40">
          Очистить
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {selected.map(a => (
          <span key={a.id} className="px-2 py-1 border rounded text-sm inline-flex items-center gap-2">
            {fio(a)} <span className="opacity-60">({a.slug})</span>
            <button type="button" onClick={() => remove(a.id)} className="opacity-60 hover:opacity-100">×</button>
          </span>
        ))}
        <button type="button" onClick={() => setOpen(true)} className="px-2 py-1 border rounded text-sm" aria-label="Добавить авторов">＋</button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" className="bg-white rounded-xl shadow w-full max-w-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Выбрать авторов</div>
              <button type="button" onClick={() => setOpen(false)} className="text-xl leading-none">×</button>
            </div>

            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск по ФИО или slug" className="w-full border rounded p-2" />
            <div className="max-h-56 overflow-auto border rounded">
              {loading ? <div className="p-3 text-sm opacity-60">Загрузка…</div>
                : list.length===0 ? <div className="p-3 text-sm opacity-60">Ничего не найдено</div>
                : (
                  <ul>
                    {list.map(a => (
                      <li key={a.id} className="flex items-center justify-between p-2 border-b last:border-b-0">
                        <label className="flex items-center gap-2 text-sm cursor-pointer">
                          <input type="checkbox" checked={isChecked(a.id)} onChange={() => toggle(a)} />
                          <span>{fio(a)} <span className="opacity-60">({a.slug})</span></span>
                        </label>
                        {!isChecked(a.id) && (
                          <button type="button" onClick={() => toggle(a)} className="px-2 py-1 border rounded text-sm">Добавить</button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
            </div>

            <div className="flex justify-end">
              <button type="button" className="px-3 py-2 rounded border" onClick={() => setOpen(false)}>Готово</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
