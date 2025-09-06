// src/app/u/[id]/user-avatar.tsx
"use client";

import { useState } from "react";

export default function UserAvatar({ image, name }: { image: string | null; name: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => image && setOpen(true)}
        className="h-20 w-20 overflow-hidden rounded-full bg-neutral-200 ring-1 ring-neutral-300 flex items-center justify-center text-3xl cursor-pointer"
      >
        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={name || "Аватар"} className="h-full w-full object-cover" />
        ) : (
          <span>🙂</span>
        )}
      </button>

      {open && image && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setOpen(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={name || "Аватар"}
            className="max-h-[90vh] max-w-[90vw] rounded-xl shadow-lg"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-4 right-4 text-white text-2xl font-bold hover:text-neutral-300"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>
      )}
    </>
  );
}
