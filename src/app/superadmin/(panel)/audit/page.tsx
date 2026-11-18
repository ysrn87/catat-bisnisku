import { db } from '@/lib/db';
import { LIMIT_LABELS, formatLimit, type LimitKey } from '@/lib/limit-constants';

type Change = { from: number | null; to: number | null };

export default async function SuperAdminAuditPage() {
  const logs = await db.superAdminAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Riwayat perubahan</h1>
        <p className="mt-1 text-sm text-gray-500">100 perubahan terakhir pada batas paket dan batas toko.</p>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-600">
            <tr>
              <th className="px-4 py-3 font-medium">Waktu</th>
              <th className="px-4 py-3 font-medium">Oleh</th>
              <th className="px-4 py-3 font-medium">Target</th>
              <th className="px-4 py-3 font-medium">Perubahan</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {logs.length === 0 && (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-500">Belum ada perubahan.</td></tr>
            )}
            {logs.map((log) => {
              const changes = (log.changes ?? {}) as Record<string, Change>;
              return (
                <tr key={log.id} className="align-top">
                  <td className="whitespace-nowrap px-4 py-3">{log.createdAt.toLocaleString('id-ID')}</td>
                  <td className="px-4 py-3">{log.actorEmail}</td>
                  <td className="px-4 py-3">{log.targetLabel}</td>
                  <td className="px-4 py-3">
                    <ul className="space-y-0.5">
                      {Object.entries(changes).map(([key, c]) => (
                        <li key={key}>
                          {LIMIT_LABELS[key as LimitKey] ?? key}: {formatLimit(c.from)} → <span className="font-medium">{formatLimit(c.to)}</span>
                        </li>
                      ))}
                    </ul>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
