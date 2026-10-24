import Link from "next/link";

// 自訂 404 仍需回傳真正的 404 狀態碼（Next 會處理）；避免「軟 404」讓搜尋引擎收錄不存在的實體頁
export default function NotFound() {
  return (
    <main className="wrap main">
      <h1>Page not found</h1>
      <p className="muted">The company, person or story you are looking for does not exist.</p>
      <p>
        <Link href="/">Back to the platform home</Link>
      </p>
    </main>
  );
}
