/**
 * 以 Google Places 的 regularOpeningHours 計算「現在是否營業」。
 * 在前端計算的好處：只要快取了每週時段，就能隨時得到即時狀態，
 * 不必每次查看都呼叫 Google API。
 */

export type HoursPoint = { day: number; hour: number; minute: number };
export type HoursPeriod = { open: HoursPoint; close?: HoursPoint };
export type OpeningHours = {
  openNow?: boolean;
  periods?: HoursPeriod[];
  weekdayDescriptions?: string[];
};

export type OpenStatus =
  | { state: "open"; detail: string }
  | { state: "closed"; detail: string }
  | { state: "temp_closed" }
  | { state: "perm_closed" }
  | { state: "unknown" };

const DAY_MIN = 24 * 60;
const WEEK_MIN = 7 * DAY_MIN;
const WEEKDAY = ["日", "一", "二", "三", "四", "五", "六"];

function pointToMin(p: HoursPoint): number {
  return p.day * DAY_MIN + (p.hour || 0) * 60 + (p.minute || 0);
}

/** 把「一週內的第幾分鐘」格式化成 今天/明天/週X HH:MM（相對於 nowMin） */
function fmt(targetMin: number, nowMin: number): string {
  const hh = String(Math.floor((targetMin % DAY_MIN) / 60)).padStart(2, "0");
  const mm = String(targetMin % 60).padStart(2, "0");
  const dayDiff =
    (Math.floor(targetMin / DAY_MIN) - Math.floor(nowMin / DAY_MIN) + 7) % 7;
  if (dayDiff === 0) return `今天 ${hh}:${mm}`;
  if (dayDiff === 1) return `明天 ${hh}:${mm}`;
  return `週${WEEKDAY[Math.floor(targetMin / DAY_MIN) % 7]} ${hh}:${mm}`;
}

export function computeOpenStatus(
  hours: OpeningHours | null,
  utcOffsetMinutes: number | null | undefined,
  businessStatus: string,
  now: Date = new Date()
): OpenStatus {
  if (businessStatus === "CLOSED_PERMANENTLY") return { state: "perm_closed" };
  if (businessStatus === "CLOSED_TEMPORARILY") return { state: "temp_closed" };

  const periods = hours?.periods;
  if (!periods || periods.length === 0 || utcOffsetMinutes == null) {
    return { state: "unknown" };
  }

  // 換算成店家當地時間，取「本週第幾分鐘」（週日 00:00 為 0）
  const local = new Date(now.getTime() + utcOffsetMinutes * 60_000);
  const t = local.getUTCDay() * DAY_MIN + local.getUTCHours() * 60 + local.getUTCMinutes();

  // Google 對 24 小時營業的表示法：單一 period 只有 open 沒有 close
  if (periods.some((p) => !p.close)) return { state: "open", detail: "24 小時營業" };

  let closesAt: number | null = null;
  let nextOpenIn = Infinity;
  let nextOpenAt = 0;
  for (const p of periods) {
    const o = pointToMin(p.open);
    let c = pointToMin(p.close!);
    if (c <= o) c += WEEK_MIN; // 跨夜或跨週的時段
    const inPeriod = (t >= o && t < c) || (t + WEEK_MIN >= o && t + WEEK_MIN < c);
    if (inPeriod) {
      const cc = c % WEEK_MIN;
      if (closesAt === null || (cc - t + WEEK_MIN) % WEEK_MIN > (closesAt - t + WEEK_MIN) % WEEK_MIN) {
        closesAt = cc;
      }
    }
    const untilOpen = (o - t + WEEK_MIN) % WEEK_MIN;
    if (untilOpen < nextOpenIn) {
      nextOpenIn = untilOpen;
      nextOpenAt = o;
    }
  }

  if (closesAt !== null) return { state: "open", detail: `營業至 ${fmt(closesAt, t)}` };
  return { state: "closed", detail: `${fmt(nextOpenAt, t)} 開門` };
}

/** 距上次更新的天數（用於判斷快取是否過期） */
export function daysSince(iso: string, now: Date = new Date()): number {
  return (now.getTime() - new Date(iso).getTime()) / 86_400_000;
}
