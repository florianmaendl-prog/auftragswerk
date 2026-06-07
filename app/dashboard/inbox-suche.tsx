'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { HugeiconsIcon } from '@hugeicons/react';
import { Search01Icon, CancelCircleIcon } from '@hugeicons/core-free-icons';

/**
 * Inbox-Suchleiste. URL-Param `?q=...` damit Suche shareable bleibt und
 * Reload sie nicht vergisst. Inbox-Page filtert serverseitig auf
 * Betreff / Von-Name / Von-Email.
 *
 * Debounced 200ms damit nicht bei jedem Tastendruck ein router.push
 * triggert.
 */
export function InboxSuche() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get('q') ?? '';
  const [value, setValue] = useState(initialQ);

  useEffect(() => {
    const handle = setTimeout(() => {
      const current = new URLSearchParams(params.toString());
      if (value.trim()) {
        current.set('q', value.trim());
      } else {
        current.delete('q');
      }
      const qs = current.toString();
      router.push(qs ? `/dashboard?${qs}` : '/dashboard');
    }, 200);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div className="relative">
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
        placeholder="Suchen (Betreff, Name, Email)…"
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
  );
}
