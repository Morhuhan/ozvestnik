"use client";

import React, { useCallback, useMemo, useRef, useState } from "react";
import { useToast } from "../../components/toast/ToastProvider";

type Props = {
  action: string;
  accept: string;
  allowedMimes: string[];
  allowedExts: string[];
};

export default function UploadForm({ action, accept, allowedMimes, allowedExts }: Props) {
  const toast = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const isImage = file ? (file.type || "").toLowerCase().startsWith("image/") : false;

  const formatsHint = useMemo(() => {
    const img = allowedExts.filter((e) => ["jpg","jpeg","png","webp","gif","avif","svg"].includes(e));
    const vid = allowedExts.filter((e) => ["mp4","webm","mov","m4v","ogg"].includes(e));
    const uniq = (arr: string[]) => Array.from(new Set(arr));
    const imgList = uniq(img).join(", ");
    const vidList = uniq(vid).join(", ");
    return `Изображения (${imgList}). Видео (${vidList}).`;
  }, [allowedExts]);

  const isAllowed = (f: File | null | undefined) => {
    if (!f) return false;
    const mime = (f.type || "").toLowerCase().trim();
    const name = (f.name || "").toLowerCase().trim();
    const ext = name.includes(".") ? name.split(".").pop()! : "";

    if (mime && allowedMimes.includes(mime)) return true;
    if (ext && allowedExts.includes(ext)) return true;
    return false;
  };

  const applyFile = useCallback(
    (f: File | null) => {
      if (!f || !isAllowed(f)) {
        setFile(null);
        setPreviewUrl(null);
        toast({
          type: "error",
          title: "Формат файла не поддерживается",
          description: "Разрешены изображения и видео. " + formatsHint,
        });
        if (fileRef.current) fileRef.current.value = "";
        return;
      }
      setFile(f);
      if (f.type.startsWith("image/")) {
        const url = URL.createObjectURL(f);
        setPreviewUrl(url);
      } else {
        setPreviewUrl(null);
      }
    },
    [formatsHint, toast]
  );

  const onFileChange: React.ChangeEventHandler<HTMLInputElement> = (e) => {
    const f = e.currentTarget.files?.[0] ?? null;
    applyFile(f);
  };

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const f = e.dataTransfer?.files?.[0] ?? null;
    if (f) {
      try {
        const dt = new DataTransfer();
        dt.items.add(f);
        if (fileRef.current) (fileRef.current as any).files = dt.files;
      } catch {}
    }
    applyFile(f);
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  };
  const onDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  };

  const clearSelection = () => {
    setFile(null);
    setPreviewUrl(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const onSubmit: React.FormEventHandler<HTMLFormElement> = (e) => {
    const f = fileRef.current?.files?.[0] ?? null;
    if (!isAllowed(f)) {
      e.preventDefault();
      toast({
        type: "error",
        title: "Неверный формат файла",
        description: "Пожалуйста, выберите поддерживаемый формат. " + formatsHint,
      });
      return;
    }

    const titleInput = formRef.current?.elements.namedItem("title") as HTMLInputElement;
    if (!titleInput || !titleInput.value.trim()) {
      e.preventDefault();
      toast({
        type: "error",
        title: "Поле title обязательно для заполнения",
        description: "Пожалуйста, введите описание для файла.",
      });
      return;
    }

    setBusy(true);
  };

  return (
    <form
      ref={formRef}
      action={action}
      method="POST"
      encType="multipart/form-data"
      onSubmit={onSubmit}
      className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_340px]"
    >
      <div
        onDrop={onDrop}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        className={[
          "relative rounded-2xl border-2 border-dashed p-5 sm:p-6 transition",
          dragOver ? "border-blue-500 bg-blue-50/50" : "border-neutral-300 bg-neutral-50",
        ].join(" ")}
      >
        <div className="flex flex-col items-center justify-center text-center gap-3">
          {previewUrl ? (
            <img
              src={previewUrl}
              alt="Превью"
              className="max-h-64 rounded-xl ring-1 ring-black/10 object-contain bg-white"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-xl ring-1 ring-black/10 bg-white text-4xl">
              {file
                ? (isImage ? "🖼️" : "🎬")
                : "⬆️"}
            </div>
          )}

          <div className="text-sm text-neutral-700">
            Перетащите файл сюда или{" "}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="font-semibold text-blue-700 underline underline-offset-2"
            >
              выберите на устройстве
            </button>
          </div>

          <div className="text-xs text-neutral-500">{formatsHint}</div>

          <input
            ref={fileRef}
            type="file"
            name="file"
            required
            accept={accept}
            className="sr-only"
            onChange={onFileChange}
          />

          {file && (
            <div className="mt-2 rounded-lg bg-white ring-1 ring-neutral-200 px-3 py-2 text-sm text-neutral-800">
              Выбран: <span className="font-medium">{file.name}</span>{" "}
              <span className="text-neutral-500">({Math.ceil(file.size / 1024)} КБ)</span>
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-neutral-50 ring-1 ring-neutral-200 p-4 sm:p-5">
        <div className="mb-3">
          <label className="mb-1 block text-xs text-neutral-600">Title (обязательно)</label>
          <input
            name="title"
            required
            className="w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-neutral-300 focus:outline-none focus:ring-2 focus:ring-neutral-800 disabled:opacity-60"
            disabled={busy}
            placeholder="Описание для файла"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            className="inline-flex h-10 items-center rounded-lg bg-neutral-900 px-4 text-sm font-medium text-white hover:bg-neutral-800 disabled:opacity-60"
            disabled={busy}
          >
            {busy ? "Загрузка…" : "Загрузить"}
          </button>

          <button
            type="button"
            onClick={clearSelection}
            disabled={busy || !file}
            className="inline-flex h-10 items-center rounded-lg bg-white px-4 text-sm font-medium text-neutral-800 ring-1 ring-neutral-300 hover:bg-neutral-100 disabled:opacity-60"
          >
            Очистить
          </button>
        </div>

        <p className="mt-3 text-xs text-neutral-500">
          Файл будет загружен в библиотеку. Alt-текст будет автоматически установлен равным описанию.
        </p>
      </div>
    </form>
  );
}