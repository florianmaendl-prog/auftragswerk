'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  Image02Icon,
  CancelCircleIcon,
  UploadCircle02Icon,
} from '@hugeicons/core-free-icons';

/**
 * Logo-Upload für die Signatur. Owner lädt einmal ein Logo hoch, beim
 * Send-Pfad wird es als Inline-Attachment unter die Signatur eingebettet.
 *
 * Klein und Praktiker-freundlich gehalten: ein Datei-Picker, ein Preview,
 * ein Löschen-Button. Keine Crop-/Resize-Tools – Owner kennt seine Files.
 *
 * Limits: 2 MB, PNG/JPEG/SVG/WEBP, 1 Logo pro Betrieb (Upload überschreibt).
 */
export function LogoUploader() {
  const router = useRouter();
  const confirm = useConfirm();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [contentType, setContentType] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [lade, setLade] = useState(true);

  // Initial-Load: prüfen ob Logo schon da ist (Signed-URL)
  useEffect(() => {
    let mounted = true;
    fetch('/api/profil/logo')
      .then((res) => res.json())
      .then((data) => {
        if (!mounted) return;
        if (data?.logo?.url) {
          setLogoUrl(data.logo.url);
          setContentType(data.logo.content_type ?? null);
        }
      })
      .catch(() => undefined)
      .finally(() => mounted && setLade(false));
    return () => {
      mounted = false;
    };
  }, []);

  async function handleUpload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch('/api/profil/logo', {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Upload fehlgeschlagen');
        return;
      }
      // Neu signed-URL holen für Preview
      const meta = await fetch('/api/profil/logo').then((r) => r.json());
      setLogoUrl(meta?.logo?.url ?? null);
      setContentType(meta?.logo?.content_type ?? null);
      toast.success('Logo gespeichert');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete() {
    if (busy) return;
    const ok = await confirm({
      title: 'Logo entfernen?',
      description:
        'Die Signatur wird danach wieder als Plain-Text ohne Logo versendet.',
      confirmLabel: 'Logo entfernen',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch('/api/profil/logo', { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Löschen fehlgeschlagen');
        return;
      }
      setLogoUrl(null);
      setContentType(null);
      toast.success('Logo entfernt');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md border border-input bg-muted/20 p-3 space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <HugeiconsIcon icon={Image02Icon} size={16} strokeWidth={1.5} />
        Logo unter der Signatur
      </div>

      {logoUrl && contentType && (
        <div className="flex items-center gap-3 rounded-md border border-input bg-background p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt="Logo-Vorschau"
            className="max-h-16 max-w-[140px] object-contain"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground">
              Wird unter die Signatur eingebettet.
            </p>
            <p className="text-[11px] text-muted-foreground font-mono">
              {contentType}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDelete}
            disabled={busy}
            className="gap-1.5 text-destructive hover:text-destructive"
          >
            <HugeiconsIcon
              icon={CancelCircleIcon}
              size={14}
              strokeWidth={1.5}
            />
            Entfernen
          </Button>
        </div>
      )}

      {!logoUrl && !lade && (
        <p className="text-xs text-muted-foreground">
          Optional. PNG, JPEG, SVG oder WEBP. Max 2 MB.
        </p>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/svg+xml,image/webp"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) handleUpload(file);
        }}
        disabled={busy}
        className="hidden"
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => fileInputRef.current?.click()}
        disabled={busy}
        className="gap-1.5"
      >
        <HugeiconsIcon
          icon={UploadCircle02Icon}
          size={14}
          strokeWidth={1.5}
        />
        {logoUrl ? 'Logo austauschen' : 'Logo hochladen'}
      </Button>
    </div>
  );
}
