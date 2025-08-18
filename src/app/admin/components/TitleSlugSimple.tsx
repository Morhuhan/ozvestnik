"use client"

import { useEffect, useState } from "react"
import { slugify } from "../../../../lib/slugify"

export function TitleSlugSimple({
  defaultTitle = "",
  defaultSlug = "",
  titleName = "title",
  slugName = "slug",
  titleError,
  slugError,
  onValues,
  disableNames,
  requireSlug = false,
  // NEW:
  hideTitle = false,      // скрыть инпут заголовка
  titleValue,             // внешнее значение заголовка (для автогенерации slug)
}: {
  defaultTitle?: string
  defaultSlug?: string
  titleName?: string
  slugName?: string
  titleError?: string
  slugError?: string
  onValues?: (v: { title: string; slug: string; slugTouched: boolean }) => void
  disableNames?: boolean
  requireSlug?: boolean
  hideTitle?: boolean
  titleValue?: string
}) {
  const [title, setTitle] = useState(defaultTitle)
  const [slug, setSlug]   = useState(defaultSlug)
  const [slugTouched, setSlugTouched] = useState(Boolean(defaultSlug))

  // синхронизация с внешним titleValue (например, ФИО)
  useEffect(() => {
    if (typeof titleValue === "string" && titleValue !== title) {
      setTitle(titleValue)
      if (!slugTouched) setSlug(slugify(titleValue))
    }
  }, [titleValue, title, slugTouched])

  // автогенерация slug от локального title (когда редактируем заголовок)
  useEffect(() => {
    if (!slugTouched) setSlug(slugify(title))
  }, [title, slugTouched])

  useEffect(() => {
    onValues?.({ title, slug, slugTouched })
  }, [title, slug, slugTouched, onValues])

  return (
    <div className="space-y-3">
      {!hideTitle && (
        <div>
          <input
            name={disableNames ? undefined : titleName}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Заголовок"
            className={`w-full border rounded p-2 ${titleError ? "border-red-400" : ""}`}
            required
            aria-invalid={Boolean(titleError)}
          />
          {titleError && <div className="text-sm text-red-600 mt-1">{titleError}</div>}
        </div>
      )}

      <div>
        <input
          name={disableNames ? undefined : slugName}
          value={slug}
          onChange={(e) => { setSlugTouched(true); setSlug(e.target.value) }}
          placeholder="slug"
          className={`w-full border rounded p-2 ${slugError ? "border-red-400" : ""}`}
          aria-invalid={Boolean(slugError)}
          required={requireSlug}
        />
        {slugError && <div className="text-sm text-red-600 mt-1">{slugError}</div>}
      </div>
    </div>
  )
}
