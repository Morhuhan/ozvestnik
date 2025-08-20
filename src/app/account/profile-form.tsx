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
      setRemoveAvatar(false); // если выбрали новый файл — не удаляем
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

    // Предупреждение про недельный лимит, если имя меняется
    if (name.trim() !== (initial.name || "").trim()) {
      const ok = window.confirm(
        "Вы собираетесь изменить имя профиля.\n\n" +
          "Имя можно менять не чаще одного раза в неделю.\n" +
          "Продолжить?"
      );
      if (!ok) return;
    }

    startTransition(async () => {
      try {
        if (!formRef.current) return;

        const fd = new FormData(formRef.current);
        // Явно проставим флаг удаления
        fd.set("removeAvatar", removeAvatar ? "1" : "");

        const res = (await saveProfile(fd)) as SaveResult;

        if (res.ok) {
          toast({ type: "success", title: "Профиль обновлён" });
          router.refresh();
          // очистить blob preview
          if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
        } else {
          toast({
            type: "error",
            title: "Ошибка",
            description: res.error || "Не удалось сохранить профиль",
          });
        }
      } catch (err: any) {
        toast({
          type: "error",
          title: "Ошибка",
          description: err?.message || "Что-то пошло не так",
        });
      }
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-4">
      {/* Аватар */}
      <div>
        <label className="block text-sm mb-1">Аватар</label>

        <div className="flex items-center gap-4">
          <div className="h-16 w-16 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center">
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt="avatar preview" className="h-full w-full object-cover" />
            ) : (
              <span className="text-xl">🙂</span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <input
              ref={fileRef}
              name="avatar"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={onPickFile}
              disabled={pending}
            />
            {previewUrl && (
              <button
                type="button"
                onClick={onClearAvatar}
                className="px-2 py-1 text-xs border rounded w-fit"
                disabled={pending}
              >
                Убрать аватар
              </button>
            )}
            <p className="text-xs opacity-70">
              Поддерживается PNG/JPEG/WEBP/GIF. Максимум 2&nbsp;МБ.
            </p>
          </div>
        </div>
        {/* скрытый флаг удаления */}
        <input type="hidden" name="removeAvatar" value={removeAvatar ? "1" : ""} />
      </div>

      {/* Имя */}
      <div>
        <label className="block text-sm mb-1">Имя (публично)</label>
        <input
          className="w-full border rounded p-2"
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          minLength={2}
          required
          placeholder="Ваше имя"
          disabled={pending}
        />
        <p className="text-xs opacity-70 mt-1">
          Имя видно на сайте рядом с комментариями. Менять имя можно не чаще, чем{" "}
          <b>1 раз в неделю</b>.
        </p>
      </div>

      {/* Обо мне */}
      <div>
        <label className="block text-sm mb-1">Обо мне</label>
        <textarea
          className="w-full border rounded p-2 h-32"
          name="bio"
          defaultValue={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Пара слов о себе…"
          disabled={pending}
        />
      </div>

      <button
        type="submit"
        className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        disabled={pending}
      >
        {pending ? "Сохранение…" : "Сохранить"}
      </button>
    </form>
  );
}
