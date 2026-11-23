// Rentang waktu dashboard (zona waktu tetap WIB / UTC+7, tanpa DST).
// Server Vercel berjalan di UTC, jadi semua pengelompokan hari dihitung manual
// dengan menggeser +7 jam supaya penjualan 00.00–07.00 WIB tidak masuk ke hari sebelumnya.

export type DashboardRange = 'day' | 'week' | 'month';

export const RANGE_OPTIONS: { value: DashboardRange; label: string }[] = [
  { value: 'day', label: 'Harian' },
  { value: 'week', label: 'Mingguan' },
  { value: 'month', label: 'Bulanan' },
];

export const RANGE_META: Record<DashboardRange, { title: string; compareLabel: string }> = {
  day:   { title: 'Hari ini',        compareLabel: 'kemarin' },
  week:  { title: '7 hari terakhir', compareLabel: '7 hari sebelumnya' },
  month: { title: 'Bulan ini',       compareLabel: 'bulan lalu' },
};

const WIB_OFFSET_MS = 7 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const DAY_NAMES = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function parseRange(value: string | undefined | null): DashboardRange {
  return value === 'week' || value === 'month' ? value : 'day';
}

/** Date UTC untuk awal hari (00:00 WIB) dari komponen tanggal WIB. */
function wibMidnight(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, day) - WIB_OFFSET_MS);
}

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
  prevEnd: Date;    // dipotong sepanjang waktu yang sudah berjalan, agar perbandingan adil
  buckets: Bucket[];
}

export function getRangeWindow(range: DashboardRange, now: Date = new Date()): RangeWindow {
  const n = toWib(now);
  const todayStart = wibMidnight(n.year, n.month, n.day);

  let start: Date;
  let end: Date;
  let prevStart: Date;
  const buckets: Bucket[] = [];

  if (range === 'day') {
    start = todayStart;
    end = new Date(start.getTime() + DAY);
    prevStart = new Date(start.getTime() - DAY);
    for (let h = 0; h < 24; h++) {
      const bs = new Date(start.getTime() + h * HOUR);
      const hh = String(h).padStart(2, '0');
      buckets.push({
        key: `h${h}`,
        label: hh,
        tooltip: `Pukul ${hh}.00–${hh}.59`,
        start: bs,
        end: new Date(bs.getTime() + HOUR),
      });
    }
  } else if (range === 'week') {
    start = new Date(todayStart.getTime() - 6 * DAY);
    end = new Date(todayStart.getTime() + DAY);
    prevStart = new Date(start.getTime() - 7 * DAY);
    for (let i = 0; i < 7; i++) {
      const bs = new Date(start.getTime() + i * DAY);
      const w = toWib(bs);
      buckets.push({
        key: `d${i}`,
        label: DAY_NAMES[w.weekday],
        tooltip: `${DAY_NAMES[w.weekday]}, ${w.day} ${MONTH_NAMES[w.month]}`,
        start: bs,
        end: new Date(bs.getTime() + DAY),
      });
    }
  } else {
    start = wibMidnight(n.year, n.month, 1);
    end = wibMidnight(n.year, n.month + 1, 1);
    prevStart = wibMidnight(n.year, n.month - 1, 1);
    const days = Math.round((end.getTime() - start.getTime()) / DAY);
    for (let i = 0; i < days; i++) {
      const bs = new Date(start.getTime() + i * DAY);
      const w = toWib(bs);
      buckets.push({
        key: `d${i}`,
        label: String(w.day),
        tooltip: `${w.day} ${MONTH_NAMES[w.month]} ${w.year}`,
        start: bs,
        end: new Date(bs.getTime() + DAY),
      });
    }
  }

  // Periode pembanding dibatasi sepanjang waktu yang sudah berjalan di periode ini.
  const elapsed = Math.max(0, Math.min(now.getTime(), end.getTime()) - start.getTime());
  const prevEnd = new Date(prevStart.getTime() + elapsed);

  return { range, start, end, prevStart, prevEnd, buckets };
}

/** Selisih persen; null bila periode pembanding kosong (tidak bisa dibandingkan). */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}
