import { prisma } from "../../../../lib/db";
import { requireRole } from "../../../../lib/session";
import MediaGrid from "../components/MediaGrid";


export default async function MediaPage() {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);

  const assets = await prisma.mediaAsset.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      kind: true,
      mime: true,
      filename: true,
      title: true,
      alt: true,
      createdAt: true,
    },
  });

  return (
    <div className="max-w-5xl space-y-6">
      <h1 className="text-2xl font-bold">Медиа</h1>

      {/* простая форма загрузки — без клиентских обработчиков */}
      <form
        action="/api/admin/media/upload"
        method="POST"
        encType="multipart/form-data"
        className="flex flex-wrap gap-3 items-end"
      >
        <label className="flex flex-col">
          <span className="text-sm mb-1">Файл</span>
          <input type="file" name="file" required className="border rounded p-2" />
        </label>
        <label className="flex flex-col">
          <span className="text-sm mb-1">Title (необязательно)</span>
          <input name="title" className="border rounded p-2" />
        </label>
        <label className="flex flex-col">
          <span className="text-sm mb-1">Alt (необязательно)</span>
          <input name="alt" className="border rounded p-2" />
        </label>
        <button className="px-4 py-2 rounded bg-black text-white">Загрузить</button>
      </form>

      {/* Сетка превью — это Client Component */}
      <MediaGrid assets={assets} />
    </div>
  );
}
