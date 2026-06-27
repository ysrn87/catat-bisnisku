'use client';

import { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { searchStoreAction, joinStoreAction } from '@/actions/join-store';
import { useDebounce } from '@/hooks/use-debounce';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Search, Store, ArrowRight, Loader2 } from 'lucide-react';
import Link from 'next/link';

interface StoreResult {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
}

export default function JoinStorePage() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, 300);
  const [results, setResults] = useState<StoreResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [joiningSlug, setJoiningSlug] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setResults([]);
      return;
    }
    setSearching(true);
    searchStoreAction(debouncedQuery).then((res) => {
      if (res.success) setResults(res.data);
      setSearching(false);
    });
  }, [debouncedQuery]);

  function handleJoin(store: StoreResult) {
    setError(null);
    setJoiningSlug(store.slug);
    startTransition(async () => {
      const result = await joinStoreAction(store.slug);
      if (result.success && result.data) {
        router.push(`/${result.data.slug}/member`);
      } else {
        setError(result.error || 'Gagal join toko');
        setJoiningSlug(null);
      }
    });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[#e0f9fc] via-[#f0fdfe] to-[#d6f7fa] p-4 py-12">
      <Card className="w-full max-w-md shadow-2xl border-0 relative z-10 backdrop-blur-sm bg-white/95">
        <CardHeader className="space-y-2 pb-4">
          <div className="mx-auto w-12 h-12 rounded-2xl bg-[#e0f9fc] flex items-center justify-center">
            <Store className="w-6 h-6 text-[#028697]" />
          </div>
          <CardTitle className="text-xl font-bold text-center text-[#028697]">
            Cari & Gabung Toko
          </CardTitle>
          <CardDescription className="text-center text-sm">
            Akun kamu sudah jadi. Cari nama atau slug toko untuk mulai jadi member.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              autoFocus
              placeholder="Nama atau slug toko..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-11 pl-9 text-sm focus-visible:ring-[#a8f0f8]"
            />
          </div>

          {error && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 p-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="space-y-2 min-h-[100px]">
            {searching && (
              <div className="flex justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-[#a8f0f8]" />
              </div>
            )}

            {!searching && debouncedQuery && results.length === 0 && (
              <p className="text-center text-xs text-gray-400 py-6">
                Toko tidak ditemukan. Coba kata lain atau minta link/QR dari toko.
              </p>
            )}

            {!searching && results.map((store) => (
              <button
                key={store.id}
                onClick={() => handleJoin(store)}
                disabled={isPending}
                className="w-full flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-[#a8f0f8] hover:bg-[#e0f9fc] transition-colors text-left disabled:opacity-50"
              >
                <div className="w-10 h-10 rounded-lg bg-[#e0f9fc] flex items-center justify-center flex-shrink-0 text-[#028697] font-semibold">
                  {store.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{store.name}</p>
                  <p className="text-xs text-gray-500 truncate">@{store.slug}</p>
                </div>
                {joiningSlug === store.slug && isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin text-[#028697]" />
                ) : (
                  <ArrowRight className="w-4 h-4 text-gray-400" />
                )}
              </button>
            ))}
          </div>

          <Link href="/store-select" className="block">
            <Button variant="outline" className="w-full h-10 text-sm">
              Kembali
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
