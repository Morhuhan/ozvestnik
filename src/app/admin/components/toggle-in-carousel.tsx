// src/app/admin/articles/toggle-in-carousel.tsx
"use client";

import { useState, useTransition } from "react";
import { setArticleCarouselDirect } from "../articles/actions";

export default function ToggleInCarousel({
  id,
  isPublished,
  initialChecked,
}: {
  id: string;
  isPublished: boolean;
  initialChecked: boolean;
}) {
  const [checked, setChecked] = useState(initialChecked);
  const [pending, startTransition] = useTransition();

  async function apply(next: boolean) {
    // optimistic UI
    setChecked(next);
    const res = await setArticleCarouselDirect(id, next);
    if (!res.ok) {
      // откат при ошибке
      setChecked(!next);
      if (res.error === "not_published") {
        alert("Добавлять в карусель можно только опубликованные статьи.");
      } else {
        alert("Не удалось сохранить. Попробуйте ещё раз.");
      }
    }
  }

  return (
    <label className="inline-flex items-center gap-2" title={isPublished ? "" : "Только для опубликованных"}>
      <input
        type="checkbox"
        className="h-4 w-4"
        disabled={!isPublished || pending}
        checked={checked}
        onChange={(e) => startTransition(() => apply(e.target.checked))}
        aria-label="Добавить в карусель"
      />
      {!isPublished && <span className="text-[11px] text-red-500">Только для опубликованных</span>}
      {pending && <span className="text-[11px] text-neutral-500">Сохранение…</span>}
    </label>
  );
}
