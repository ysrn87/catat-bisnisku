'use client';

import { useState, useEffect, useRef, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, SlidersHorizontal, ChevronDown, X, Check, Filter } from 'lucide-react';

interface Product {
  id: string;
  name: string;
}

interface LandingFiltersProps {
  products: Product[];
  layout?: 'bar' | 'sidebar';
}

const SORT_OPTIONS = [
  { value: 'default',    label: 'Default' },
  { value: 'price_asc',  label: 'Harga: Terendah' },
  { value: 'price_desc', label: 'Harga: Tertinggi' },
  { value: 'name_asc',   label: 'Nama: A–Z' },
  { value: 'name_desc',  label: 'Nama: Z–A' },
];

export function LandingFilters({ products, layout = 'bar' }: LandingFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch]           = useState(searchParams.get('q') || '');
  const [sort, setSort]               = useState(searchParams.get('sort') || 'default');
  const [productId, setProductId]     = useState(searchParams.get('product') || '');
  const [sortOpen, setSortOpen]       = useState(false);
  const [productOpen, setProductOpen] = useState(false);

  const sortRef    = useRef<HTMLDivElement>(null);
  const productRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) setSortOpen(false);
      if (productRef.current && !productRef.current.contains(e.target as Node)) setProductOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Sync from URL when params change (shared between bar and sidebar)
  useEffect(() => {
    setSearch(searchParams.get('q') || '');
    setSort(searchParams.get('sort') || 'default');
    setProductId(searchParams.get('product') || '');
  }, [searchParams]);

  const push = (q: string, s: string, p: string) => {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (s && s !== 'default') params.set('sort', s);
    if (p) params.set('product', p);
    startTransition(() => router.replace(`?${params.toString()}`, { scroll: false }));
  };

  const handleSearch  = (val: string) => { setSearch(val); push(val, sort, productId); };
  const handleSort    = (val: string) => { setSort(val); setSortOpen(false); push(search, val, productId); };
  const handleProduct = (val: string) => {
    const next = productId === val ? '' : val;
    setProductId(next);
    setProductOpen(false);
    push(search, sort, next);
  };
  const clearAll = () => {
    setSearch(''); setSort('default'); setProductId('');
    startTransition(() => router.replace('?', { scroll: false }));
  };

  const hasFilters      = search || sort !== 'default' || productId;
  const selectedProduct = products.find(p => p.id === productId);
  const selectedSort    = SORT_OPTIONS.find(o => o.value === sort);

  // ── SIDEBAR layout (desktop) ─────────────────────────────────────────────
  if (layout === 'sidebar') {
    return (
      <div className="space-y-5">
        {/* Search */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Cari</p>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Produk atau varian..."
              className="w-full pl-8 pr-8 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#028697] focus:ring-2 focus:ring-[#028697]/10 placeholder:text-slate-300 transition-all"
            />
            {search && (
              <button onClick={() => handleSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* Product filter */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Kategori</p>
          <div className="space-y-0.5">
            <button
              onClick={() => handleProduct('')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                !productId ? 'bg-[#028697] text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Semua Produk
              {!productId && <Check className="w-3.5 h-3.5" />}
            </button>
            {products.map(p => (
              <button
                key={p.id}
                onClick={() => handleProduct(p.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors text-left ${
                  productId === p.id ? 'bg-[#028697] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="truncate pr-2">{p.name}</span>
                {productId === p.id && <Check className="w-3.5 h-3.5 flex-shrink-0" />}
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Urutkan</p>
          <div className="space-y-0.5">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => handleSort(opt.value)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  sort === opt.value ? 'bg-[#028697] text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {opt.label}
                {sort === opt.value && <Check className="w-3.5 h-3.5" />}
              </button>
            ))}
          </div>
        </div>

        {/* Clear */}
        {hasFilters && (
          <button
            onClick={clearAll}
            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-medium text-red-500 hover:bg-red-50 border border-red-100 rounded-xl transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            Reset Filter
          </button>
        )}
      </div>
    );
  }

  // ── BAR layout (mobile, default) ─────────────────────────────────────────
  return (
    <div className="space-y-2.5 pt-4 pb-3 sticky top-14 z-40 bg-[#f8fffe] border-b border-slate-100">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Cari produk atau varian..."
          className="w-full pl-9 pr-9 py-2.5 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:border-[#028697] focus:ring-2 focus:ring-[#028697]/10 placeholder:text-slate-300 transition-all"
        />
        {search && (
          <button onClick={() => handleSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-500 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2">
        {/* Product dropdown */}
        <div className="relative flex-1" ref={productRef}>
          <button
            onClick={() => { setProductOpen(v => !v); setSortOpen(false); }}
            className={`w-full flex items-center justify-between gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-all ${
              productId ? 'bg-[#028697] text-white border-[#028697]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#028697]/40'
            }`}
          >
            <span className="truncate">{selectedProduct ? selectedProduct.name : 'Semua Produk'}</span>
            <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${productOpen ? 'rotate-180' : ''}`} />
          </button>
          {productOpen && (
            <div className="absolute top-full left-0 mt-1.5 w-full min-w-[180px] bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
              <div className="max-h-52 overflow-y-auto">
                <button
                  onClick={() => handleProduct('')}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-left hover:bg-slate-50 transition-colors ${!productId ? 'text-[#028697]' : 'text-slate-700'}`}
                >
                  Semua Produk
                  {!productId && <Check className="w-3.5 h-3.5 text-[#028697]" />}
                </button>
                <div className="border-t border-slate-100" />
                {products.map(p => (
                  <button
                    key={p.id}
                    onClick={() => handleProduct(p.id)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-left hover:bg-slate-50 transition-colors ${productId === p.id ? 'text-[#028697]' : 'text-slate-700'}`}
                  >
                    <span className="truncate pr-2">{p.name}</span>
                    {productId === p.id && <Check className="w-3.5 h-3.5 text-[#028697] flex-shrink-0" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sort dropdown */}
        <div className="relative flex-1" ref={sortRef}>
          <button
            onClick={() => { setSortOpen(v => !v); setProductOpen(false); }}
            className={`w-full flex items-center justify-between gap-1.5 text-xs font-medium px-3 py-2 rounded-xl border transition-all ${
              sort !== 'default' ? 'bg-[#028697] text-white border-[#028697]' : 'bg-white text-slate-600 border-slate-200 hover:border-[#028697]/40'
            }`}
          >
            <SlidersHorizontal className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="truncate flex-1 text-left ml-1">{sort !== 'default' ? selectedSort?.label : 'Urutkan'}</span>
            <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ${sortOpen ? 'rotate-180' : ''}`} />
          </button>
          {sortOpen && (
            <div className="absolute top-full right-0 mt-1.5 w-44 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden z-50">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => handleSort(opt.value)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-xs font-medium text-left hover:bg-slate-50 transition-colors ${sort === opt.value ? 'text-[#028697]' : 'text-slate-700'}`}
                >
                  {opt.label}
                  {sort === opt.value && <Check className="w-3.5 h-3.5 text-[#028697]" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {hasFilters && (
          <button
            onClick={clearAll}
            className="flex-shrink-0 flex items-center justify-center w-9 h-9 text-slate-400 hover:text-red-500 bg-white border border-slate-200 rounded-xl transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}