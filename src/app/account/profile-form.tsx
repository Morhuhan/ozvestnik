"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "../components/toast/ToastProvider";
import { saveProfile } from "./profile.actions";

type SaveResult = { ok: true } | { ok: false; error: string };

export default function ProfileForm({
  initial,
}: {
  initial: { name: string; image: string; bio: string };
}) {
  const [name, setName] = useState(initial.name);
  const [bio, setBio] = useState(initial.bio);
  const [previewUrl, setPreviewUrl] = useState<string | null>(initial.image || null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const toast = useToast();
  const formRef = useRef<HTMLFormElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] || null;
    if (f) {
      const url = URL.createObjectURL(f);
      setPreviewUrl(url);
      setRemoveAvatar(false);
    } else {
      setPreviewUrl(initial.image || null);
    }
  }

  function onClearAvatar() {
    setPreviewUrl(null);
    setRemoveAvatar(true);
    if (fileRef.current) fileRef.current.value = "";
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (name.trim() !== (initial.name || "").trim()) {
      const ok = window.confirm(
        "Вы собираетесь изменить имя профиля.\n\nИмя можно менять не чаще одного раза в неделю.\nПродолжить?"
      );
      if (!ok) return;
    }

    startTransition(async () => {
      if (!formRef.current) return;

      const fd = new FormData(formRef.current);
      fd.set("removeAvatar", removeAvatar ? "1" : "");

      const res = (await saveProfile(fd)) as SaveResult;

      if (res.ok) {
        toast({ type: "success", title: "Профиль обновлён" });
        router.refresh();
        if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      } else {
        toast({
          type: "error",
          title: "Ошибка",
          description: res.error || "Не удалось сохранить профиль",
        });
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-6">
      <div>
        <label className="mb-2 block text-sm font-medium text-neutral-900">Аватар</label>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="group relative h-28 w-28 cursor-pointer overflow-hidden rounded-full bg-neutral-200 ring-1 ring-neutral-300 shadow-sm transition hover:brightness-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-400"
            title="Выбрать файл"
          >
            {previewUrl ? (
              <img src={previewUrl} alt="avatar preview" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-2xl">🙂</span>
            )}
            <span className="pointer-events-none absolute inset-0 hidden items-end justify-center bg-black/10 pb-1 text-[11px] text-white group-hover:flex">
              Изменить
            </span>
          </button>

          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              name="avatar"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onPickFile}
              disabled={pending}
              className="hidden"
            />

            {previewUrl && (
              <button
                type="button"
                onClick={onClearAvatar}
                className="w-fit rounded-lg px-2 py-1 text-xs ring-1 ring-neutral-300 hover:bg-neutral-100 disabled:opacity-50"
                disabled={pending}
              >
                Убрать аватар
              </button>
            )}

            <p className="text-xs text-neutral-600">PNG/JPEG/WEBP/GIF, до 2&nbsp;МБ.</p>
          </div>
        </div>

        <input type="hidden" name="removeAvatar" value={removeAvatar ? "1" : ""} />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-neutral-900">Имя</label>
        <input
          className="w-full rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 transition focus:outline-none focus:ring-2 focus:ring-neutral-600 disabled:opacity-50"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          required
          placeholder="Ваше имя"
          disabled={pending}
        />
        <p className="mt-1 text-xs text-neutral-600">
          Имя видно на сайте рядом с комментариями. Менять можно не чаще, чем <b>1 раз в неделю</b>.
        </p>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-neutral-900">Обо мне</label>
        <textarea
          className="h-32 w-full resize-y rounded-lg bg-white px-3 py-2 ring-1 ring-neutral-300 transition focus:outline-none focus:ring-2 focus:ring-neutral-600 disabled:opacity-50"
          name="bio"
          defaultValue={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Пара слов о себе…"
          disabled={pending}
        />
      </div>

      <button
        type="submit"
        className="rounded-lg bg-neutral-900 px-4 py-2 text-white transition hover:bg-neutral-800 disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Сохранение…" : "Сохранить"}
      </button>
    </form>
  );
}
