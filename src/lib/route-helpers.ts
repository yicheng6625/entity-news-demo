import "server-only";
import { notFound } from "next/navigation";
import { isPublicationSlug, publications, type Publication } from "./publications";

/** 將路由參數轉成刊物設定；未知刊物直接 404，避免任意前綴產生無限多的重複頁面被爬蟲收錄 */
export async function resolvePub(params: Promise<{ pub: string }>): Promise<Publication> {
  const { pub } = await params;
  if (!isPublicationSlug(pub)) notFound();
  return publications[pub];
}
