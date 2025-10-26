import { requireRole } from "../../../../../lib/session";
import { NewArticleForm } from "./NewArticleForm";

export const dynamic = "force-dynamic";

export default async function NewArticlePage() {
  await requireRole(["AUTHOR", "EDITOR", "ADMIN"]);
  return <NewArticleForm />;
}