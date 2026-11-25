// Rentang waktu dashboard (zona waktu tetap WIB / UTC+7, tanpa DST).
// Server Vercel berjalan di UTC, jadi semua pengelompokan hari dihitung manual
// dengan menggeser +7 jam supaya penjualan 00.00–07.00 WIB tidak masuk ke hari sebelumnya.
//
// Model filter:
//  - day / week / month  → periode dihitung dari "tanggal acuan" (`date`, default hari ini)
//      day   : tanggal itu
//      week  : 7 hari yang BERAKHIR di tanggal itu
//      month : bulan kalender yang memuat tanggal itu
//  - custom              → rentang bebas `from`–`to` (inklusif), maks. MAX_CUSTOM_DAYS hari
// Tanggal selalu berformat YYYY-MM-DD (kalender WIB) dan tidak pernah melewati hari ini.

export type DashboardRange = 'day' | 'week' | 'month' | 'custom';

export const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: 'day', label: 'Harian' },
  { value: 'week', label: 'Mingguan' },
  { value: 'month', label: 'Bulanan' },
  { value: 'custom', label: 'Kustom' },
];

export const MAX_CUSTOM_DAYS = 92;

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const DAY_SHORT = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const DAY_FULL = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const MONTH_FULL = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
];

// ── Helper tanggal (YYYY-MM-DD, kalender WIB) ───────────────────────────────

const pad = (n: number) => String(n).padStart(2, '0');

/** `month` berbasis 0 (seperti Date). */
export function formatYmd(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

export function parseYmd(value?: string | null): { year: number; month: number; day: number } | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  if (y < 2000 || t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return { year: y, month: m - 1, day: d };
}

export function addDaysYmd(value: string, days: number): string {
  const p = parseYmd(value)!;
  const t = new Date(Date.UTC(p.year, p.month, p.day + days));
  return formatYmd(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
}

/** Selisih hari kalender (b − a). */
function diffDays(a: string, b: string): number {
  const pa = parseYmd(a)!;
  const pb = parseYmd(b)!;
  return Math.round((Date.UTC(pb.year, pb.month, pb.day) - Date.UTC(pa.year, pa.month, pa.day)) / DAY);
}

/** Date UTC untuk awal hari (00:00 WIB) dari komponen tanggal WIB. */
function wibMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - WIB_OFFSET_MS);
}

const ymdMidnight = (value: string) => {
  const p = parseYmd(value)!;
  return wibMidnight(p.year, p.month, p.day);
};

/** Komponen tanggal/jam dalam WIB untuk sebuah instant. */
export function toWib(date: Date) {
  const s = new Date(date.getTime() + WIB_OFFSET_MS);
  return {
    year: s.getUTCFullYear(),
    month: s.getUTCMonth(),
    day: s.getUTCDate(),
    hour: s.getUTCHours(),
    weekday: s.getUTCDay(),
  };
}

export function todayYmd(now: Date = new Date()): string {
  const w = toWib(now);
  return formatYmd(w.year, w.month, w.day);
}

const weekdayOf = (value: string) => {
  const p = parseYmd(value)!;
  return new Date(Date.UTC(p.year, p.month, p.day)).getUTCDay();
};

const fmtDate = (value: string, withYear = true) => {
  const p = parseYmd(value)!;
  return `${p.day} ${MONTH_SHORT[p.month]}${withYear ? ` ${p.year}` : ''}`;
};

// ── Query (URL) ─────────────────────────────────────────────────────────────

export interface DashboardQuery {
  range: DashboardRange;
  /** day/week/month: tanggal acuan; kosong = hari ini. */
  date?: string;
  /** custom saja. */
  from?: string;
  to?: string;
}

/** Baca & rapikan parameter URL; nilai tidak valid jatuh ke default, tanggal masa depan dipotong ke hari ini. */
export function parseDashboardQuery(
  sp: { range?: string; date?: string; from?: string; to?: string },
  now: Date = new Date()
): DashboardQuery {
  const today = todayYmd(now);
  const range: DashboardRange =
    sp.range === 'week' || sp.range === 'month' || sp.range === 'custom' ? sp.range : 'day';

  if (range === 'custom') {
    let to = parseYmd(sp.to) ? sp.to! : today;
    let from = parseYmd(sp.from) ? sp.from! : addDaysYmd(to, -6);
    if (to > today) to = today;
    if (from > today) from = today;
    if (from > to) [from, to] = [to, from];
    if (diffDays(from, to) + 1 > MAX_CUSTOM_DAYS) from = addDaysYmd(to, -(MAX_CUSTOM_DAYS - 1));
    return { range, from, to };
  }

  let date = parseYmd(sp.date) ? sp.date! : today;
  if (date > today) date = today;
  return { range, date: date === today ? undefined : date };
}

export function queryToSearch(q: DashboardQuery): string {
  const params = new URLSearchParams({ range: q.range });
  if (q.range === 'custom') {
    if (q.from) params.set('from', q.from);
    if (q.to) params.set('to', q.to);
  } else if (q.date) {
    params.set('date', q.date);
  }
  return `?${params.toString()}`;
}

// ── Jendela waktu ───────────────────────────────────────────────────────────

export interface Bucket {
  key: string;      // kunci unik per bucket
  label: string;    // label sumbu X (pendek)
  tooltip: string;  // label tooltip (lengkap)
  start: Date;
  end: Date;
}

export interface RangeWindow {
  range: DashboardRange;
  start: Date;      // inklusif
  end: Date;        // eksklusif (akhir periode penuh)
  prevStart: Date;
  prevEnd: Date;    // dipotong sepanjang waktu berjalan bila periode masih berlangsung
  buckets: Bucket[];

  startYmd: string;
  lastYmd: string;      // hari terakhir (inklusif)
  anchorYmd: string;    // tanggal acuan (custom: tanggal akhir)
  todayYmd: string;
  days: number;
  isCurrent: boolean;   // periode masih berlangsung (memuat saat ini)
  title: string;
  periodText: string;
  compareLabel: string;

  prevQuery: DashboardQuery | null;
  nextQuery: DashboardQuery | null;
  todayQuery: DashboardQuery | null; // null bila sudah di periode sekarang
}

export function getRangeWindow(q: DashboardQuery, now: Date = new Date()): RangeWindow {
  const today = todayYmd(now);
  const range = q.range;
  const anchorYmd = range === 'custom' ? q.to ?? today : q.date ?? today;
  const anchor = parseYmd(anchorYmd)!;

  let startYmd: string;
  let lastYmd: string;
  if (range === 'day') {
    startYmd = lastYmd = anchorYmd;
  } else if (range === 'week') {
    lastYmd = anchorYmd;
    startYmd = addDaysYmd(anchorYmd, -6);
  } else if (range === 'month') {
    startYmd = formatYmd(anchor.year, anchor.month, 1);
    const lastDay = new Date(Date.UTC(anchor.year, anchor.month + 1, 0)).getUTCDate();
    lastYmd = formatYmd(anchor.year, anchor.month, lastDay);
  } else {
    startYmd = q.from ?? addDaysYmd(anchorYmd, -6);
    lastYmd = anchorYmd;
  }

  const days = diffDays(startYmd, lastYmd) + 1;
  const start = ymdMidnight(startYmd);
  const end = ymdMidnight(addDaysYmd(lastYmd, 1));
  const isCurrent = now.getTime() >= start.getTime() && now.getTime() < end.getTime();

  // Periode pembanding: periode sebelumnya yang berdampingan.
  let prevStart: Date;
  if (range === 'month') {
    prevStart = wibMidnight(anchor.year, anchor.month - 1, 1);
  } else {
    prevStart = new Date(start.getTime() - (range === 'week' ? 7 : days) * DAY);
  }
  // Periode berjalan dibandingkan secara adil (sepanjang waktu yang sudah lewat);
  // periode yang sudah selesai dibandingkan penuh.
  const prevEnd = isCurrent
    ? new Date(prevStart.getTime() + Math.max(0, now.getTime() - start.getTime()))
    : start;

  // Bucket grafik
  const buckets: Bucket[] = [];
  if (days === 1) {
    for (let h = 0; h < 24; h++) {
      const bs = new Date(start.getTime() + h * HOUR);
      const hh = pad(h);
      buckets.push({ key: `h${h}`, label: hh, tooltip: `Pukul ${hh}.00–${hh}.59`, start: bs, end: new Date(bs.getTime() + HOUR) });
    }
  } else {
    const crossesMonth = startYmd.slice(0, 7) !== lastYmd.slice(0, 7);
    for (let i = 0; i < days; i++) {
      const dayYmd = addDaysYmd(startYmd, i);
      const p = parseYmd(dayYmd)!;
      const bs = ymdMidnight(dayYmd);
      const label = days <= 7 ? DAY_SHORT[weekdayOf(dayYmd)] : crossesMonth ? `${p.day}/${p.month + 1}` : String(p.day);
      buckets.push({
        key: `d${i}`,
        label,
        tooltip: `${DAY_SHORT[weekdayOf(dayYmd)]}, ${fmtDate(dayYmd)}`,
        start: bs,
        end: new Date(bs.getTime() + DAY),
      });
    }
  }

  // Teks periode & judul
  let periodText: string;
  if (range === 'day') {
    periodText = `${DAY_FULL[weekdayOf(startYmd)]}, ${fmtDate(startYmd)}`;
  } else if (range === 'month') {
    periodText = `${MONTH_FULL[anchor.month]} ${anchor.year}`;
  } else {
    const sameYear = startYmd.slice(0, 4) === lastYmd.slice(0, 4);
    periodText = `${fmtDate(startYmd, !sameYear)} – ${fmtDate(lastYmd)}`;
  }

  let title: string;
  let compareLabel: string;
  if (range === 'day') {
    title = isCurrent ? 'Hari ini' : periodText;
    compareLabel = isCurrent ? 'kemarin' : 'hari sebelumnya';
  } else if (range === 'week') {
    title = isCurrent ? '7 hari terakhir' : '7 hari berakhir ' + fmtDate(lastYmd);
    compareLabel = '7 hari sebelumnya';
  } else if (range === 'month') {
    title = isCurrent ? 'Bulan ini' : periodText;
    compareLabel = isCurrent ? 'bulan lalu' : 'bulan sebelumnya';
  } else {
    title = `Kustom · ${days} hari`;
    compareLabel = `${days} hari sebelumnya`;
  }

  // Navigasi periode
  const shift = (dir: -1 | 1): DashboardQuery | null => {
    if (range === 'day') {
      const a = addDaysYmd(anchorYmd, dir);
      return a > today ? null : { range, date: a === today ? undefined : a };
    }
    if (range === 'week') {
      if (dir === 1 && anchorYmd >= today) return null;
      let a = addDaysYmd(anchorYmd, 7 * dir);
      if (a > today) a = today;
      return { range, date: a === today ? undefined : a };
    }
    if (range === 'month') {
      const target = new Date(Date.UTC(anchor.year, anchor.month + dir, 1));
      const ty = target.getUTCFullYear();
      const tm = target.getUTCMonth();
      const firstOfTarget = formatYmd(ty, tm, 1);
      if (firstOfTarget > today) return null;
      const t = parseYmd(today)!;
      return { range, date: ty === t.year && tm === t.month ? undefined : firstOfTarget };
    }
    // custom: geser sebesar panjang rentang
    const from = addDaysYmd(startYmd, days * dir);
    let to = addDaysYmd(lastYmd, days * dir);
    if (from > today) return null;
    if (to > today) to = today;
    return { range, from, to };
  };

  const todayQuery: DashboardQuery | null = isCurrent
    ? null
    : range === 'custom'
      ? { range, from: addDaysYmd(today, -(days - 1)), to: today }
      : { range };

  return {
    range, start, end, prevStart, prevEnd, buckets,
    startYmd, lastYmd, anchorYmd, todayYmd: today, days, isCurrent,
    title, periodText, compareLabel,
    prevQuery: shift(-1),
    nextQuery: shift(1),
    todayQuery,
  };
}

/** Query saat berpindah mode (Harian/Mingguan/Bulanan/Kustom) dengan mempertahankan konteks tanggal. */
export function queryForRange(win: RangeWindow, target: DashboardRange): DashboardQuery {
  if (target === 'custom') {
    const to = win.lastYmd > win.todayYmd ? win.todayYmd : win.lastYmd;
    return { range: 'custom', from: win.startYmd > to ? to : win.startYmd, to };
  }
  const date = win.anchorYmd > win.todayYmd ? win.todayYmd : win.anchorYmd;
  return { range: target, date: date === win.todayYmd ? undefined : date };
}

/** Selisih persen; null bila periode pembanding kosong (tidak bisa dibandingkan). */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
