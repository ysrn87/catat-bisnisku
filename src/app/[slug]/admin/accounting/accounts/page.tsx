import { db } from '@/lib/db';
import { getStoreContext } from '@/lib/store-context';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AccountDialog } from '@/components/accounting/account-dialog';
import { AccountRowActions } from '@/components/accounting/account-row-actions';
import { Lock, Info } from 'lucide-react';

const TYPE_META: Record<string, { label: string; color: string; prefix: string }> = {
  ASSET:     { label: 'Aset',       color: 'border-blue-200 text-blue-700 bg-blue-50',      prefix: '1' },
  LIABILITY: { label: 'Liabilitas', color: 'border-orange-200 text-orange-700 bg-orange-50', prefix: '2' },
  EQUITY:    { label: 'Ekuitas',    color: 'border-purple-200 text-purple-700 bg-purple-50', prefix: '3' },
  REVENUE:   { label: 'Pendapatan', color: 'border-green-200 text-green-700 bg-green-50',    prefix: '4' },
  EXPENSE:   { label: 'Beban',      color: 'border-red-200 text-red-700 bg-red-50',          prefix: '5' },
};

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE'];

export default async function AccountsPage() {
  const { storeId } = await getStoreContext();

  const accounts = await db.account.findMany({
    where:   { storeId },
    orderBy: { code: 'asc' },
  });

  // Group by type sesuai urutan konvensi
  const grouped = TYPE_ORDER.map((type) => ({
    type,
    meta:     TYPE_META[type],
    accounts: accounts.filter(a => a.type === type),
  }));

  const totalActive   = accounts.filter(a => a.isActive).length;
  const totalInactive = accounts.filter(a => !a.isActive).length;

  return (
    <div className="space-y-5">

      {/* Header + Tambah */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>{totalActive} akun aktif</span>
            {totalInactive > 0 && (
              <><span>·</span><span>{totalInactive} nonaktif</span></>
            )}
          </div>
        </div>
        <AccountDialog mode="create" />
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50/50 px-4 py-3">
        <Info className="w-4 h-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 space-y-0.5">
          <p className="font-medium">Konvensi penomoran: 1xxx Aset · 2xxx Liabilitas · 3xxx Ekuitas · 4xxx Pendapatan · 5xxx Beban</p>
          <p className="text-blue-600">Akun dengan ikon <Lock className="w-3 h-3 inline" /> adalah akun sistem yang tidak dapat dihapus atau diganti kode/tipenya.</p>
        </div>
      </div>

      {/* Tabel per kelompok */}
      {grouped.map(({ type, meta, accounts: groupAccounts }) => {
        if (groupAccounts.length === 0) return null;
        return (
          <Card key={type}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge variant="outline" className={`text-xs ${meta.color}`}>
                  {meta.prefix}xxx
                </Badge>
                {meta.label}
                <span className="text-xs font-normal text-muted-foreground ml-auto">
                  {groupAccounts.filter(a => a.isActive).length} aktif
                  {groupAccounts.filter(a => !a.isActive).length > 0 &&
                    ` · ${groupAccounts.filter(a => !a.isActive).length} nonaktif`
                  }
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-[10px] text-muted-foreground uppercase tracking-wide">
                    <th className="text-left py-2 pr-3 font-medium w-16">Kode</th>
                    <th className="text-left py-2 pr-3 font-medium">Nama Akun</th>
                    <th className="text-center py-2 pr-3 font-medium w-20">Status</th>
                    <th className="text-right py-2 font-medium w-24">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {groupAccounts.map((account) => (
                    <tr
                      key={account.id}
                      className={`hover:bg-gray-50/50 transition-colors group ${!account.isActive ? 'opacity-50' : ''}`}
                    >
                      {/* Kode */}
                      <td className="py-2.5 pr-3">
                        <span className="font-mono text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">
                          {account.code}
                        </span>
                      </td>

                      {/* Nama */}
                      <td className="py-2.5 pr-3">
                        <div className="flex items-center gap-1.5">
                          {account.isSystem && (
                            <Lock className="w-3 h-3 text-gray-400 shrink-0" />
                          )}
                          <span className={`text-sm ${!account.isActive ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {account.name}
                          </span>
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-2.5 pr-3 text-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] px-1.5 ${
                            account.isActive
                              ? 'border-green-200 text-green-700 bg-green-50'
                              : 'border-gray-200 text-gray-400'
                          }`}
                        >
                          {account.isActive ? 'Aktif' : 'Nonaktif'}
                        </Badge>
                      </td>

                      {/* Aksi */}
                      <td className="py-2.5 text-right">
                        <AccountRowActions
                          account={{
                            id:       account.id,
                            code:     account.code,
                            name:     account.name,
                            type:     account.type as any,
                            isSystem: account.isSystem,
                            isActive: account.isActive,
                          }}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        );
      })}

    </div>
  );
}
