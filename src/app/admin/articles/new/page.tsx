// src/app/admin/articles/new/page.tsx
import { requireRole } from "../../../../../lib/session";
import { NewArticleForm } from "./NewArticleForm";

export const dynamic = "force-dynamic"; // на всякий случай, чтобы страница не кешировалась

export default async function NewArticlePage() {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);
  return <NewArticleForm />;
}
