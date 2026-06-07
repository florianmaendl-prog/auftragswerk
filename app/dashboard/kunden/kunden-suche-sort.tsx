'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, CancelCircleIcon } from '@hugeicons/core-free-icons';

const SORT_OPTIONEN: { value: string; label: string }[] = [
  { value: 'letzter_kontakt', label: 'Letzter Kontakt' },
  { value: 'name', label: 'Name A–Z' },
  { value: 'anzahl', label: 'Anzahl Anfragen' },
];

/**
 * Such- + Sortier-Leiste für die Kunden-Liste. URL-Params
 * `?q=...&sort=...` für shareable Links + Reload-Stabilität.
 * Such-Input ist debounced (200ms), Sort-Dropdown triggert sofort.
 *
 * Server-Component filtert + sortiert basierend auf den Params.
 */
export function KundenSucheSort() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get('q') ?? '';
  const initialSort = params.get('sort') ?? 'letzter_kontakt';

  const [value, setValue] = useState(initialQ);

  // Debounced Search-URL-Update
  useEffect(() => {
    const handle = setTimeout(() => {
      const next = new URLSearchParams(params.toString());
      if (value.trim()) next.set('q', value.trim());
      else next.delete('q');
      const qs = next.toString();
      router.push(qs ? `/dashboard/kunden?${qs}` : '/dashboard/kunden');
    }, 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  function setSort(s: string) {
    const next = new URLSearchParams(params.toString());
    if (s === 'letzter_kontakt') next.delete('sort');
    else next.set('sort', s);
    const qs = next.toString();
    router.push(qs ? `/dashboard/kunden?${qs}` : '/dashboard/kunden');
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <div className="relative flex-1">
        <HugeiconsIcon
          icon={Search01Icon}
          size={14}
          strokeWidth={1.5}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <Input
          type="search"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Kunde suchen (Name, Firma, Email)…"
          className="pl-9 pr-9 h-9"
        />
        {value && (
          <button
            type="button"
            onClick={() => setValue('')}
            aria-label="Suche leeren"
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1"
          >
            <HugeiconsIcon icon={CancelCircleIcon} size={14} strokeWidth={1.5} />
          </button>
        )}
      </div>
      <select
        value={initialSort}
        onChange={(e) => setSort(e.target.value)}
        className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        aria-label="Kunden sortieren nach"
      >
        {SORT_OPTIONEN.map((s) => (
          <option key={s.value} value={s.value}>
            Sortieren: {s.label}
          </option>
        ))}
      </select>
    </div>
  );
}
