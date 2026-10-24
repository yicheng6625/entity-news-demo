// 資料新鮮度判斷：以「營業日」計算落後天數。
// 用日曆天會在每個週一早上把所有公司誤報為過期（週末本來就沒有收盤價），造成告警疲勞。

export const STALE_AFTER_BUSINESS_DAYS = 2;

/** 計算 from 之後到 to（含）之間的營業日數；兩者皆為 YYYY-MM-DD（UTC） */
export function businessDaysBetween(from: string, to: string): number {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (end <= start) return 0;
  let days = 0;
  const cursor = new Date(start);
  while (cursor < end) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    const dow = cursor.getUTCDay();
    if (dow !== 0 && dow !== 6) days++;
  }
  return days;
}

export function isStale(lastDate: string | null, today: string, threshold = STALE_AFTER_BUSINESS_DAYS): boolean {
  // 有代號卻完全沒有價格資料，比「落後」更嚴重，必須列為過期
  if (!lastDate) return true;
  return businessDaysBetween(lastDate, today) > threshold;
}

export function todayUtc(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}
