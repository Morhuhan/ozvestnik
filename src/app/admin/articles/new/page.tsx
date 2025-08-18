import { requireRole } from "../../../../../lib/session"
import { createArticle } from "../actions"
import { TitleSlugSimple } from "../../components/TitleSlugSimple"
import { CreateTagButton } from "../../components/CreateTagButton"
import { CreateSectionButton } from "../../components/CreateSectionButton"
import { CreateAuthorButton } from "../../components/CreateAuthorButton"
import { TagPicker } from "../../components/TagPicker"
import { AuthorPicker } from "../../components/AuthorPicker"
import { SectionPicker } from "../../components/SectionPicker"

export default async function NewArticlePage({
  searchParams,
}: { searchParams: Promise<{ error?: string; field?: string }> }) {
  await requireRole(["AUTHOR","EDITOR","ADMIN"])
  const { error, field } = await searchParams
  const titleError = field === "title" ? error : undefined
  const slugError  = field === "slug"  ? error : undefined

  return (
    <form action={createArticle} className="max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold">Новая статья</h1>

      <TitleSlugSimple titleError={titleError} slugError={slugError} />

      <label className="block">
        <div className="text-sm mb-1">Подзаголовок</div>
        <input name="subtitle" className="w-full border rounded p-2" placeholder="Подзаголовок (необязательно)" />
      </label>

      {/* Раздел */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-sm mb-1">Раздел</div>
          <SectionPicker name="section" />
        </div>
        <div className="pt-6 pl-2">
          <CreateSectionButton />
        </div>
      </div>

      {/* Теги */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-sm mb-1">Теги</div>
          <TagPicker name="tags" />
        </div>
        <div className="pt-6 pl-2">
          <CreateTagButton />
        </div>
      </div>

      {/* Авторы */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="text-sm mb-1">Авторы</div>
          <AuthorPicker name="authors" />
        </div>
        <div className="pt-6 pl-2">
          <CreateAuthorButton />
        </div>
      </div>

      <label className="block">
        <div className="text-sm mb-1">Текст</div>
        <textarea name="body" className="w-full border rounded p-2 h-60" placeholder="Текст" required />
      </label>

      <div className="flex gap-2">
        <button className="px-4 py-2 rounded bg-black text-white">Сохранить черновик</button>
      </div>
    </form>
  )
}
