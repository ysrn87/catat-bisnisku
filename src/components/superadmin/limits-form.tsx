'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  LIMIT_KEYS,
  LIMIT_LABELS,
  UNLIMITED,
  formatLimit,
  type LimitKey,
  type RawLimits,
} from '@/lib/limit-constants';

type Mode = 'default' | 'custom' | 'unlimited';
type ActionResult = { success: boolean; error?: string; message?: string };

interface Props {
  action:         (formData: FormData) => Promise<ActionResult>;
  /** Field tersembunyi, mis. { storeId } atau { plan } */
  hidden:         Record<string, string>;
  current:        RawLimits;
  /** Nilai yang berlaku bila memilih "ikut default" (-1 = tak terbatas) */
  inherited:      Record<LimitKey, number>;
  inheritedLabel: string;
  submitLabel?:   string;
}

function toState(v: number | null): { mode: Mode; value: string } {
  if (v === null)      return { mode: 'default',   value: '' };
  if (v === UNLIMITED) return { mode: 'unlimited', value: '' };
  return { mode: 'custom', value: String(v) };
}

export function LimitsForm({ action, hidden, current, inherited, inheritedLabel, submitLabel = 'Simpan' }: Props) {
  const [state, setState] = useState(
    () => Object.fromEntries(LIMIT_KEYS.map((k) => [k, toState(current[k])])) as Record<LimitKey, { mode: Mode; value: string }>
  );
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ActionResult | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    setResult(null);
    startTransition(async () => {
      setResult(await action(fd));
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {Object.entries(hidden).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}

      <div className="divide-y divide-gray-100">
        {LIMIT_KEYS.map((key) => {
          const s = state[key];
          return (
            <div key={key} className="grid gap-2 py-3 sm:grid-cols-[170px_170px_1fr] sm:items-center">
              <label htmlFor={`${key}_mode`} className="text-sm font-medium text-gray-700">
                {LIMIT_LABELS[key]}
              </label>

              <select
                id={`${key}_mode`}
                name={`${key}_mode`}
                value={s.mode}
                disabled={pending}
                onChange={(e) =>
                  setState((prev) => ({ ...prev, [key]: { ...prev[key], mode: e.target.value as Mode } }))
                }
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="default">{inheritedLabel}</option>
                <option value="custom">Atur angka</option>
                <option value="unlimited">Tak terbatas</option>
              </select>

              <div className="flex items-center gap-2">
                {s.mode === 'custom' ? (
                  <Input
                    name={key}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    step={1}
                    required
                    value={s.value}
                    disabled={pending}
                    onChange={(e) =>
                      setState((prev) => ({ ...prev, [key]: { ...prev[key], value: e.target.value } }))
                    }
                    className="h-10 w-36"
                  />
                ) : (
                  <span className="text-xs text-gray-500">
                    {s.mode === 'unlimited'
                      ? 'Tidak ada batas'
                      : `${inheritedLabel}: ${formatLimit(inherited[key])}`}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {result && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            result.success
              ? 'border-green-200 bg-green-50 text-green-700'
              : 'border-red-200 bg-red-50 text-red-700'
          }`}
        >
          {result.success ? result.message : result.error}
        </div>
      )}

      <Button type="submit" disabled={pending} className="bg-[#028697] text-white hover:bg-[#0fa8be]">
        {pending ? 'Menyimpan...' : submitLabel}
      </Button>
    </form>
  );
}
