'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, SlidersHorizontal, X, CalendarDays } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useDebounce } from '@/hooks/use-debounce';
import { useEffect, useRef } from 'react';

interface FilterOption  { value: string; label: string; }
interface FilterConfig  { key: string; label: string; options: FilterOption[]; defaultValue?: string; }
interface SortOption    { value: string; label: string; }

interface SearchFilterBarProps {
  searchPlaceholder?: string;
  filters?: FilterConfig[];
  sortOptions?: SortOption[];
  defaultSort?: string;
  /** If provided, renders a date-range picker that updates these two URL params */
  dateRangeKeys?: { from: string; to: string };
}

export function SearchFilterBar({
  searchPlaceholder = 'Search...',
  filters = [],
  sortOptions = [],
  defaultSort,
  dateRangeKeys,
}: SearchFilterBarProps) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();

  const [search, setSearch]           = useState(searchParams.get('search') || '');
  const [showFilters, setShowFilters] = useState(false);
  const isInitialMount = useRef(true);
  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (isInitialMount.current) { isInitialMount.current = false; return; }
    const params = new URLSearchParams(searchParams.toString());
    const currentSearch = searchParams.get('search') || '';
    if (debouncedSearch !== currentSearch) {
      if (debouncedSearch) { params.set('search', debouncedSearch); params.set('page', '1'); }
      else params.delete('search');
      router.push(`${pathname}?${params.toString()}`, { scroll: false });
    }
  }, [debouncedSearch]);

  const handleFilterChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    const filter = filters.find(f => f.key === key);
    const defaultValue = filter?.defaultValue || 'all';
    if (value && value !== defaultValue) { params.set(key, value); params.set('page', '1'); }
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleSortChange = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== defaultSort) params.set('sort', value);
    else params.delete('sort');
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleDateChange = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) { params.set(key, value); params.set('page', '1'); }
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const handleClearAll = () => {
    setSearch('');
    router.push(pathname, { scroll: false });
  };

  const dateFrom = dateRangeKeys ? searchParams.get(dateRangeKeys.from) || '' : '';
  const dateTo   = dateRangeKeys ? searchParams.get(dateRangeKeys.to)   || '' : '';

  const activeFilterCount =
    filters.filter(f => { const v = searchParams.get(f.key); return v && v !== (f.defaultValue || 'all'); }).length +
    (search ? 1 : 0) +
    (dateFrom ? 1 : 0) +
    (dateTo   ? 1 : 0);

  return (
    <div className="space-y-2">
      {/* Row 1: Search */}
      <div className="flex flex-col sm:flex-row gap-1 sm:gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8 pr-7 h-9 text-sm"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-gray-100 rounded">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          )}
        </div>
        {(filters.length > 0 || sortOptions.length > 0 || dateRangeKeys) && (
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)} className="sm:hidden relative h-9">
            <SlidersHorizontal className="w-4 h-4 mr-2" />
            Filter
            {activeFilterCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#00a090] text-white text-xs rounded-full flex items-center justify-center">
                {activeFilterCount}
              </span>
            )}
          </Button>
        )}
      </div>

      {/* Row 2: Filters + Date range */}
      {(filters.length > 0 || sortOptions.length > 0 || dateRangeKeys) && (
        <div className={`flex flex-col sm:flex-row gap-2 sm:items-center ${showFilters ? 'flex' : 'hidden sm:flex'}`}>
          {/* Type filters */}
          {filters.map((filter) => {
            const currentValue = searchParams.get(filter.key) || filter.defaultValue || 'all';
            return (
              <div key={filter.key} className="w-full sm:w-auto min-w-[150px]">
                <Select value={currentValue} onValueChange={(v) => handleFilterChange(filter.key, v)}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={filter.label} />
                  </SelectTrigger>
                  <SelectContent>
                    {filter.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            );
          })}

          {/* Date range */}
          {dateRangeKeys && (
            <div className="flex items-center gap-2 flex-1 sm:flex-initial">
              <div className="relative flex-1 sm:w-36">
                <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => handleDateChange(dateRangeKeys.from, e.target.value)}
                  className="h-9 text-sm pl-8"
                  title="Dari tanggal"
                />
              </div>
              <span className="text-gray-400 text-xs shrink-0">s/d</span>
              <div className="relative flex-1 sm:w-36">
                <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <Input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => handleDateChange(dateRangeKeys.to, e.target.value)}
                  className="h-9 text-sm pl-8"
                  title="Sampai tanggal"
                />
              </div>
            </div>
          )}

          {/* Sort */}
          {sortOptions.length > 0 && (
            <div className="w-full sm:w-auto min-w-[150px]">
              <Select value={searchParams.get('sort') || defaultSort || sortOptions[0].value} onValueChange={handleSortChange}>
                <SelectTrigger className="h-9 text-sm">
                  <SelectValue placeholder="Urutkan" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Clear */}
          {activeFilterCount > 0 && (
            <Button variant="ghost" onClick={handleClearAll} className="w-full sm:w-auto text-sm h-9">
              <X className="w-4 h-4 mr-1" />Hapus filter
            </Button>
          )}
        </div>
      )}

      {/* Active filter badges */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {search && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#00a090]/10 text-[#00a090] rounded-full text-xs">
              Cari: "{search}"
              <button onClick={() => setSearch('')} className="hover:opacity-70 rounded-full"><X className="w-3 h-3" /></button>
            </span>
          )}
          {dateFrom && dateRangeKeys && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#00a090]/10 text-[#00a090] rounded-full text-xs">
              Dari: {dateFrom}
              <button onClick={() => handleDateChange(dateRangeKeys.from, '')} className="hover:opacity-70"><X className="w-3 h-3" /></button>
            </span>
          )}
          {dateTo && dateRangeKeys && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#00a090]/10 text-[#00a090] rounded-full text-xs">
              S/d: {dateTo}
              <button onClick={() => handleDateChange(dateRangeKeys.to, '')} className="hover:opacity-70"><X className="w-3 h-3" /></button>
            </span>
          )}
          {filters.map((filter) => {
            const value = searchParams.get(filter.key);
            if (!value || value === (filter.defaultValue || 'all')) return null;
            const option = filter.options.find(o => o.value === value);
            if (!option) return null;
            return (
              <span key={filter.key} className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#00a090]/10 text-[#00a090] rounded-full text-xs">
                {option.label}
                <button onClick={() => handleFilterChange(filter.key, filter.defaultValue || 'all')} className="hover:opacity-70"><X className="w-3 h-3" /></button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
