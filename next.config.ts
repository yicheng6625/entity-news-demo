import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 部署到 serverless 時，SQLite 檔案不會被自動追蹤進函式包，需明確列入，否則 ISR 重新生成時會找不到資料庫
  outputFileTracingIncludes: {
    "/**": ["./data/news.db"],
  },
  // 新聞站的 HTML 回應不需要對外暴露框架資訊，減少指紋辨識面
  poweredByHeader: false,
};

export default nextConfig;
