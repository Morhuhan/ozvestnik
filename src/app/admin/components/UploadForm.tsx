// src/app/admin/media/components/UploadForm.tsx
"use client";

import React, { useRef, useState } from "react";
import { useToast } from "../../components/toast/ToastProvider";

type Props = {
  action: string;                  // /api/admin/media/upload
  accept: string;                  // e.g. ".jpg,.jpeg,.png,.webp,image/*,video/*"
  allowedMimes: string[];          // из сервера: [...IMAGE_MIME, ...VIDEO_MIME]
  allowedExts: string[];           // из сервера: [...IMAGE_EXT, ...VIDEO_EXT]
};

export default function UploadForm({ action, accept, allowedMimes, allowedExts }: Props) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const isAllowed = (file: File | null | undefined) => {
    if (!file) return false;
    const mime = (file.type || "").toLowerCase().trim();
    const name = (file.name || "").toLowerCase().trim();
    const ext = name.includes(".") ? name.split(".").pop()! : "";

    // MIME попал в список → ок
    if (mime && allowedMimes.includes(mime)) return true;

    // Проверяем по расширению, если MIME пустой/нестандартный
    if (ext && allowedExts.includes(ext)) return true;

    return false;
  };

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const file = e.currentTarget.files?.[0];
    if (!isAllowed(file)) {
      toast({
        type: "error",
        title: "Формат файла не поддерживается",
        description:
          "Разрешены изображения (jpg, jpeg, png, webp, gif, avif, svg) и видео (mp4, webm, mov, m4v, ogg).",
      });
      // очистим инпут, чтобы случайно не ушло в submit
      e.currentTarget.value = "";
    }
  };

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    const file = fileRef.current?.files?.[0] ?? null;
    if (!isAllowed(file)) {
      e.preventDefault();
      toast({
        type: "error",
        title: "Неверный формат файла",
        description:
          "Пожалуйста, выберите поддерживаемый формат (изображение или видео).",
      });
      return;
    }
    // ВАЖНО: не отключаем file/text inputs — иначе они не попадут в form-data
    setBusy(true); // блокируем только кнопку
  };

  return (
    <form
      ref={formRef}
      action={action}
      method="POST"
      encType="multipart/form-data"
      className="flex flex-wrap gap-3 items-end"
      onSubmit={onSubmit}
    >
      <label className="flex flex-col">
        <span className="text-sm mb-1">Файл</span>
        <input
          ref={fileRef}
          type="file"
          name="file"
          required
          accept={accept}
          className="border rounded p-2"
          onChange={onFileChange}
          // НЕ ставим disabled при busy — иначе поле не отправится
        />
      </label>

      <label className="flex flex-col">
        <span className="text-sm mb-1">Title (необязательно)</span>
        <input name="title" className="border rounded p-2" />
      </label>

      <label className="flex flex-col">
        <span className="text-sm mb-1">Alt (необязательно)</span>
        <input name="alt" className="border rounded p-2" />
      </label>

      <button
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-60"
        disabled={busy}
      >
        {busy ? "Загрузка…" : "Загрузить"}
      </button>
    </form>
  );
}
