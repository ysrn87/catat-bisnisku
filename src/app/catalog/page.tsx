export const dynamic = 'force-dynamic';
import { db } from '@/lib/db';
import Link from 'next/link';
import { formatCurrency } from '@/lib/utils';
import { MessageCircle, Star, ShoppingBag, Package, Clock, ChevronRight, Sparkles } from 'lucide-react';
import { LandingFilters } from '@/components/catalog/catalog-filters';
import { Suspense } from 'react';

async function getProducts() {
  const products = await db.product.findMany({
    where: { isActive: true },
    include: {
      variants: {
        where: { isActive: true },
        orderBy: { price: 'asc' },
      },
    },
    orderBy: { name: 'asc' },
  });
  return products.map((p) => ({
    ...p,
    variants: p.variants.map((v) => ({
      ...v,
      price: Number(v.price),
      cost:  Number(v.cost),
    })),
  }));
}

const WA_NUMBER = '6282331312555';
const waLink = (text: string) =>
  `https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(text)}`;

export default async function LandingPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sort?: string; product?: string }>;
}) {
  const params    = await searchParams;
  const query     = (params.q || '').toLowerCase().trim();
  const sort      = params.sort || 'default';
  const productId = params.product || '';

  const allProducts   = await getProducts();
  const allVariants   = allProducts.flatMap((p) => p.variants);
  const allPrices     = allVariants.map((v) => v.price);
  const minPrice      = allPrices.length ? Math.min(...allPrices) : 0;
  const totalProducts = allProducts.length;

  let products = allProducts;

  if (productId) {
    products = products.filter(p => p.id === productId);
  }

  if (query) {
    products = products
      .map(p => ({
        ...p,
        variants: p.variants.filter(v =>
          v.name.toLowerCase().includes(query) ||
          v.sku.toLowerCase().includes(query)
        ),
      }))
      .filter(p =>
        p.name.toLowerCase().includes(query) ||
        (p.description || '').toLowerCase().includes(query) ||
        p.variants.length > 0
      );
  }

  products = products.map(p => ({
    ...p,
    variants: [...p.variants].sort((a, b) => {
      if (sort === 'price_asc')  return a.price - b.price;
      if (sort === 'price_desc') return b.price - a.price;
      if (sort === 'name_asc')   return a.name.localeCompare(b.name);
      if (sort === 'name_desc')  return b.name.localeCompare(a.name);
      return 0;
    }),
  }));

  if (sort === 'name_asc')  products = [...products].sort((a, b) => a.name.localeCompare(b.name));
  if (sort === 'name_desc') products = [...products].sort((a, b) => b.name.localeCompare(a.name));

  const hasResults    = products.some(p => p.variants.length > 0);
  const totalVariants = products.reduce((n, p) => n + p.variants.length, 0);
  const filterProps   = allProducts.map(p => ({ id: p.id, name: p.name }));

  return (
    <div className="min-h-screen bg-[#f5faf9] text-slate-900 antialiased">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-sm border-b border-[#e0f9fc]">
        <div className="max-w-lg lg:max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/catalog" className="flex items-center gap-2 select-none">
            <div className="w-8 h-8 rounded-xl bg-[#028697] flex items-center justify-center shadow-sm">
              <ShoppingBag className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold text-[#028697] leading-none">Catat Bisnisku</p>
              <p className="text-[9px] text-slate-400 leading-none tracking-wide mt-0.5">Homemade · Halal</p>
            </div>
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-6 text-sm text-slate-500">
            <a href="#katalog" className="hover:text-[#028697] transition-colors">Katalog</a>
            <a
              href={waLink('Halo Catat Bisnisku! Saya ingin tahu lebih lanjut tentang produk.')}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#028697] transition-colors"
            >
              Hubungi Kami
            </a>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative bg-gradient-to-br from-[#028697] via-[#028697] to-[#0fa8be] overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 lg:w-96 lg:h-96 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute bottom-0 -left-6 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
        <div className="absolute top-1/2 right-1/4 w-20 h-20 lg:w-40 lg:h-40 rounded-full bg-white/5 pointer-events-none" />

        {/* Mobile hero */}
        <div className="lg:hidden max-w-lg mx-auto px-4 pt-8 pb-6 relative">
          <div className="inline-flex items-center gap-1.5 bg-white/15 border border-white/20 rounded-full px-3 py-1 mb-4">
            <Sparkles className="w-3 h-3 text-white/80" />
            <span className="text-[11px] font-semibold text-white/80 tracking-wide">Produk Homemade</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white leading-tight mb-2 tracking-tight">Catat Bisnisku</h1>
          <p className="text-white/70 text-sm leading-relaxed mb-6 max-w-xs">
            Kue & makanan buatan tangan dengan bahan pilihan. Pesan langsung, dikirim segar.
          </p>
          <div className="flex items-center gap-2.5 mb-6">
            <a
              href={waLink('Halo Catat Bisnisku! Saya ingin tahu lebih lanjut tentang produk.')}
              target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-white text-[#028697] font-bold text-sm px-4 py-2.5 rounded-xl shadow-sm hover:shadow-md transition-all active:scale-95"
            >
              <MessageCircle className="w-4 h-4" />
              Hubungi Kami
            </a>
            <a href="#katalog" className="flex items-center gap-1.5 text-white/80 text-sm font-medium hover:text-white transition-colors">
              Lihat Katalog <ChevronRight className="w-4 h-4" />
            </a>
          </div>
          {allPrices.length > 0 && (
            <div className="flex items-center gap-3">
              {[
                { label: 'Produk', value: `${totalProducts} jenis` },
                { label: 'Mulai dari', value: formatCurrency(minPrice) },
                { label: 'Varian', value: `${allVariants.length} pilihan` },
              ].map(({ label, value }) => (
                <div key={label} className="bg-white/10 border border-white/15 rounded-xl px-3 py-2">
                  <p className="text-[9px] text-white/50 uppercase tracking-widest font-semibold leading-none mb-1">{label}</p>
                  <p className="text-sm font-bold text-white leading-none">{value}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Desktop hero — two-column split */}
        <div className="hidden lg:block max-w-6xl mx-auto px-8 py-16 relative">
          <div className="flex items-center justify-between gap-12">
            {/* Left — text */}
            <div className="flex-1">
              <div className="inline-flex items-center gap-2 bg-white/15 border border-white/20 rounded-full px-4 py-1.5 mb-6">
                <Sparkles className="w-3.5 h-3.5 text-white/80" />
                <span className="text-xs font-semibold text-white/80 tracking-wide">Produk Homemade & Halal</span>
              </div>
              <h1 className="text-5xl font-extrabold text-white leading-tight mb-4 tracking-tight">
                Catat Bisnisku
              </h1>
              <p className="text-white/70 text-base leading-relaxed mb-8 max-w-sm">
                Kue & makanan buatan tangan dengan bahan pilihan berkualitas. Pesan langsung, dikirim segar ke depan pintu Anda.
              </p>
              <div className="flex items-center gap-3">
                <a
                  href={waLink('Halo Catat Bisnisku! Saya ingin tahu lebih lanjut tentang produk.')}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-white text-[#028697] font-bold px-6 py-3 rounded-xl shadow-sm hover:shadow-md transition-all"
                >
                  <MessageCircle className="w-4 h-4" />
                  Hubungi via WhatsApp
                </a>
                <a
                  href="#katalog"
                  className="flex items-center gap-2 border border-white/30 text-white font-semibold px-6 py-3 rounded-xl hover:bg-white/10 transition-all"
                >
                  Lihat Katalog <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>

            {/* Right — stats card */}
            <div className="flex-shrink-0 w-72">
              <div className="bg-white/10 border border-white/15 rounded-2xl p-6 backdrop-blur-sm">
                <p className="text-white/50 text-xs font-semibold uppercase tracking-widest mb-4">Ringkasan Katalog</p>
                <div className="space-y-4">
                  {[
                    { label: 'Jenis Produk', value: `${totalProducts}`, unit: 'produk' },
                    { label: 'Total Varian', value: `${allVariants.length}`, unit: 'pilihan' },
                    { label: 'Harga Mulai', value: formatCurrency(minPrice), unit: '' },
                  ].map(({ label, value, unit }) => (
                    <div key={label} className="flex items-center justify-between border-b border-white/10 pb-4 last:border-0 last:pb-0">
                      <p className="text-white/60 text-sm">{label}</p>
                      <p className="text-white font-bold text-sm">{value} <span className="font-normal text-white/50 text-xs">{unit}</span></p>
                    </div>
                  ))}
                </div>
                <a
                  href="#katalog"
                  className="mt-5 flex items-center justify-center gap-2 bg-white text-[#028697] font-bold text-sm py-2.5 rounded-xl w-full hover:shadow-md transition-all"
                >
                  Jelajahi Katalog <ChevronRight className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className="h-5 bg-[#f5faf9]" style={{ clipPath: 'ellipse(55% 100% at 50% 100%)' }} />
      </section>

      {/* ── Catalogue ───────────────────────────────────────────────────────── */}
      <div id="katalog" className="max-w-lg lg:max-w-6xl mx-auto px-4 lg:px-8 pb-28">

        {/* ── MOBILE: sticky bar filters ── */}
        <div className="lg:hidden">
          <Suspense fallback={<div className="h-24" />}>
            <LandingFilters products={filterProps} layout="bar" />
          </Suspense>
          {(query || productId) && (
            <p className="text-xs text-slate-400 pt-3 pb-1">
              {hasResults ? `${totalVariants} varian ditemukan` : 'Tidak ada hasil'}
            </p>
          )}
        </div>

        {/* ── DESKTOP: sidebar + main grid ── */}
        <div className="hidden lg:flex gap-8 pt-8">

          {/* Sidebar */}
          <aside className="w-56 flex-shrink-0">
            <div className="sticky top-24 bg-white border border-slate-100 rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-100">
                <div className="w-6 h-6 rounded-lg bg-[#028697]/10 flex items-center justify-center">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#028697]" />
                </div>
                <p className="text-sm font-bold text-slate-700">Filter</p>
              </div>
              <Suspense fallback={<div className="h-48" />}>
                <LandingFilters products={filterProps} layout="sidebar" />
              </Suspense>
            </div>
          </aside>

          {/* Main content */}
          <main className="flex-1 min-w-0">
            {(query || productId) && (
              <p className="text-sm text-slate-400 mb-4">
                {hasResults ? `${totalVariants} varian ditemukan` : 'Tidak ada hasil'}
              </p>
            )}

            {!hasResults ? (
              <div className="text-center py-20 text-slate-400">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">Produk tidak ditemukan</p>
                <p className="text-xs mt-1">Coba kata kunci atau filter lain</p>
              </div>
            ) : (
              <div className="space-y-10">
                {products.map((product) => {
                  if (product.variants.length === 0) return null;
                  const prices      = product.variants.map(v => v.price);
                  const minP        = Math.min(...prices);
                  const allPreorder = product.variants.every(v => v.type === 'PREORDER');
                  const hasMixed    = product.variants.some(v => v.type === 'PREORDER') && product.variants.some(v => v.type === 'READY_STOCK');

                  return (
                    <section key={product.id}>
                      <div className="flex items-start justify-between gap-4 mb-4 pb-3 border-b border-slate-100">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                            <h2 className="text-lg font-bold text-slate-900">{product.name}</h2>
                            {allPreorder && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                                <Clock className="w-2.5 h-2.5" />Pre Order
                              </span>
                            )}
                            {hasMixed && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                                Mixed
                              </span>
                            )}
                          </div>
                          {product.description && (
                            <p className="text-sm text-slate-400 leading-relaxed">{product.description}</p>
                          )}
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className="text-xs text-slate-400">mulai dari</p>
                          <p className="text-base font-bold text-[#028697]">{formatCurrency(minP)}</p>
                          <p className="text-xs text-slate-400">{product.variants.length} varian</p>
                        </div>
                      </div>
                      <VariantGrid variants={product.variants} product={product} waLink={waLink} />
                    </section>
                  );
                })}
              </div>
            )}
          </main>
        </div>

        {/* ── MOBILE product list ── */}
        <div className="lg:hidden">
          {!hasResults ? (
            <div className="text-center py-20 text-slate-400">
              <Package className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">Produk tidak ditemukan</p>
              <p className="text-xs mt-1">Coba kata kunci atau filter lain</p>
            </div>
          ) : (
            <div className="space-y-8 pt-4">
              {products.map((product) => {
                if (product.variants.length === 0) return null;
                const prices      = product.variants.map(v => v.price);
                const minP        = Math.min(...prices);
                const allPreorder = product.variants.every(v => v.type === 'PREORDER');
                const hasMixed    = product.variants.some(v => v.type === 'PREORDER') && product.variants.some(v => v.type === 'READY_STOCK');

                return (
                  <section key={product.id}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5 flex-wrap">
                          <h2 className="text-base font-bold text-slate-900">{product.name}</h2>
                          {allPreorder && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full">
                              <Clock className="w-2.5 h-2.5" />Pre Order
                            </span>
                          )}
                          {hasMixed && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-purple-100 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                              Mixed
                            </span>
                          )}
                        </div>
                        {product.description && (
                          <p className="text-xs text-slate-400 leading-relaxed">{product.description}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-[10px] text-slate-400">mulai</p>
                        <p className="text-sm font-bold text-[#028697]">{formatCurrency(minP)}</p>
                      </div>
                    </div>
                    <VariantGrid variants={product.variants} product={product} waLink={waLink} />
                  </section>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Floating WhatsApp ────────────────────────────────────────────────── */}
      <div className="fixed bottom-12 right-4 z-50">
        <a
          href={waLink('Halo Catat Bisnisku! Saya ingin tahu lebih lanjut tentang produk.')}
          target="_blank" rel="noopener noreferrer"
          className="flex items-center gap-2 bg-green-500 hover:bg-green-600 active:scale-95 text-white text-xs font-semibold px-4 py-3 rounded-full shadow-lg transition-all"
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </a>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-[#e0f9fc] bg-white">
        <div className="max-w-lg lg:max-w-6xl mx-auto px-4 lg:px-8 h-14 flex items-center justify-between">
          {/* <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-[#028697] flex items-center justify-center">
              <ShoppingBag className="w-3 h-3 text-white" />
            </div>
            <p className="text-xs font-semibold text-[#028697]">Catat Bisnisku</p>
          </div> */}
          <p className="lg:block text-[11px] text-slate-400">© {new Date().getFullYear()} Catat Bisnisku. All rights reserved.</p>
          <Link href="/login" className="text-[11px] text-slate-400 hover:text-[#028697] transition-colors">·-··</Link>
        </div>
      </footer>
    </div>
  );
}

// ─── Shared variant card grid (used by both mobile and desktop) ───────────────

type Variant = {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  lowStockAt: number;
  pointsPerUnit: number;
  type: string;
};

type Product = {
  id: string;
  name: string;
};

function VariantGrid({
  variants,
  product,
  waLink,
}: {
  variants: Variant[];
  product: Product;
  waLink: (text: string) => string;
}) {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {variants.map((variant) => {
        const isPreorder   = variant.type === 'PREORDER';
        const isOutOfStock = !isPreorder && variant.stock === 0;
        const isLowStock   = !isPreorder && variant.stock > 0 && variant.stock <= variant.lowStockAt;

        const stockBadge = isPreorder
          ? { bg: 'bg-amber-50 text-amber-700 border-amber-100', dot: '', label: 'Pre Order', icon: true }
          : isOutOfStock
          ? { bg: 'bg-red-50 text-red-600 border-red-100', dot: 'bg-red-400', label: 'Habis', icon: false }
          : isLowStock
          ? { bg: 'bg-yellow-50 text-yellow-700 border-yellow-100', dot: 'bg-yellow-400', label: 'Terbatas', icon: false }
          : { bg: 'bg-green-50 text-green-700 border-green-100', dot: 'bg-green-400', label: 'Tersedia', icon: false };

        const orderText = `Halo Catat Bisnisku! Saya ingin memesan: ${variant.name} (${product.name}).`;

        return (
          <div
            key={variant.id}
            className={`relative flex flex-col bg-white border rounded-2xl overflow-hidden transition-all duration-200 ${
              isOutOfStock
                ? 'border-slate-100 opacity-60'
                : 'border-slate-200 hover:border-[#028697]/40 hover:shadow-md active:scale-[0.98]'
            }`}
          >
            <div className={`h-1 w-full ${isPreorder ? 'bg-amber-300' : isOutOfStock ? 'bg-slate-200' : 'bg-gradient-to-r from-[#028697] to-[#0fa8be]'}`} />
            <div className="p-3 flex flex-col gap-2 flex-1">
              <div>
                <p className="text-xs font-bold text-slate-900 leading-snug">{variant.name}</p>
                <p className="text-[10px] text-slate-400 font-mono mt-0.5">{variant.sku}</p>
              </div>
              <span className={`self-start inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stockBadge.bg}`}>
                {stockBadge.icon ? <Clock className="w-2.5 h-2.5" /> : <span className={`w-1.5 h-1.5 rounded-full ${stockBadge.dot}`} />}
                {stockBadge.label}
              </span>
              <div className="mt-auto">
                <p className="text-base font-extrabold text-[#028697] leading-none">{formatCurrency(variant.price)}</p>
                {variant.pointsPerUnit > 0 && (
                  <p className="text-[10px] text-amber-600 flex items-center gap-0.5 mt-1">
                    <Star className="w-2.5 h-2.5" />+{variant.pointsPerUnit} poin
                  </p>
                )}
              </div>
              <a
                href={waLink(orderText)}
                target="_blank"
                rel="noopener noreferrer"
                aria-disabled={isOutOfStock}
                className={`mt-1 flex items-center justify-center gap-1.5 text-xs font-semibold py-2 rounded-xl transition-all ${
                  isOutOfStock
                    ? 'bg-slate-100 text-slate-400 pointer-events-none'
                    : 'bg-[#028697] text-white hover:bg-[#017585] active:scale-95'
                }`}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                {isOutOfStock ? 'Habis' : 'Pesan'}
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}