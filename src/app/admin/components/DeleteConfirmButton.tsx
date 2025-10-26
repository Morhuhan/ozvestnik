"use client";

import { useFormStatus } from "react-dom";

export function DeleteConfirmButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      onClick={(e) => {
        const ok = window.confirm("Удалить статью? Это действие необратимо.");
        if (!ok) {
          e.preventDefault();
          e.stopPropagation();
        }
      }}
      className="px-4 py-2 rounded bg-red-600 text-white disabled:opacity-60"
      disabled={pending}
      aria-busy={pending}
    >
      {pending ? "Удаляю…" : "Удалить"}
    </button>
  );
}
