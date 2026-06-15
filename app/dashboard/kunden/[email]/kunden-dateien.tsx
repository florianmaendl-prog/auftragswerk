'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { HugeiconsIcon } from '@hugeicons/react';
import {
  FileAttachmentIcon,
  UploadCircle02Icon,
  CancelCircleIcon,
  DownloadCircle02Icon,
} from '@hugeicons/core-free-icons';

type KundenDatei = {
  id: string;
  dateiname: string;
  content_type: string | null;
  groesse_bytes: number | null;
  quelle: 'inbound_anhang' | 'manuell_upload';
  anfrage_id: string | null;
  created_at: string;
};

function formatBytes(n: number | null): string {
  if (!n) return '';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

/**
 * Kunden-Dateien-Verwaltung. Zwei Quellen:
 *   - Inbound-Anhänge (automatisch verlinkt bei Klassifikation=kundenanfrage)
 *   - Manuelle Owner-Uploads (Drag&Drop / Datei-Picker)
 *
 * Owner kann Dateien per Klick herunterladen (Signed-URL 5 Min TTL) oder
 * löschen. Bei Inbound-Verknüpfung wird das Original im anhaenge-Bucket
 * NICHT angefasst – nur die kunden_dateien-Zeile.
 */
export function KundenDateien({
  kundeId,
  initialDateien,
}: {
  kundeId: string;
  initialDateien: KundenDatei[];
}) {
  const router = useRouter();
  const confirm = useConfirm();
  const [dateien, setDateien] = useState<KundenDatei[]>(initialDateien);
  const [busy, setBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(file: File) {
    setBusy(true);
    try {
      const form = new FormData();
      form.append('file', file);
      const res = await fetch(`/api/kunden/${kundeId}/dateien`, {
        method: 'POST',
        body: form,
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Upload fehlgeschlagen');
        return;
      }
      toast.success('Datei hochgeladen');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Upload fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  async function handleDownload(datei: KundenDatei) {
    try {
      const res = await fetch(`/api/kunden/${kundeId}/dateien/${datei.id}`);
      const data = await res.json();
      if (!res.ok || !data.url) {
        toast.error(data.error || 'Download-Link fehlgeschlagen');
        return;
      }
      window.open(data.url, '_blank');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Download fehlgeschlagen');
    }
  }

  async function handleDelete(datei: KundenDatei) {
    if (busy) return;
    const ok = await confirm({
      title: 'Datei entfernen?',
      description:
        datei.quelle === 'manuell_upload'
          ? `„${datei.dateiname}" wird endgültig aus dem Speicher gelöscht.`
          : `„${datei.dateiname}" wird aus der Kunden-Ablage entfernt. Die Originaldatei bleibt im Mail-Verlauf der Anfrage sichtbar.`,
      confirmLabel: 'Datei entfernen',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/kunden/${kundeId}/dateien/${datei.id}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.error || 'Löschen fehlgeschlagen');
        return;
      }
      setDateien((prev) => prev.filter((d) => d.id !== datei.id));
      toast.success('Datei entfernt');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Löschen fehlgeschlagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <HugeiconsIcon icon={FileAttachmentIcon} size={14} strokeWidth={1.5} />
          Dateien ({dateien.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {dateien.length === 0 && (
          <p className="text-xs text-muted-foreground italic">
            Noch keine Dateien. Anhänge aus Mails werden automatisch verknüpft.
          </p>
        )}

        {dateien.map((d) => (
          <div
            key={d.id}
            className="flex items-center gap-2 rounded-md border border-input bg-muted/20 p-2 text-sm"
          >
            <HugeiconsIcon
              icon={FileAttachmentIcon}
              size={14}
              strokeWidth={1.5}
              className="text-muted-foreground flex-shrink-0"
            />
            <div className="flex-1 min-w-0">
              <button
                type="button"
                onClick={() => handleDownload(d)}
                className="font-medium truncate text-left hover:text-primary block w-full text-sm"
                title="Herunterladen"
              >
                {d.dateiname}
              </button>
              <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                <span>{formatBytes(d.groesse_bytes)}</span>
                {d.quelle === 'inbound_anhang' && d.anfrage_id && (
                  <>
                    <span>·</span>
                    <Link
                      href={`/dashboard/anfragen/${d.anfrage_id}`}
                      className="hover:text-foreground underline-offset-2 hover:underline"
                    >
                      aus Mail
                    </Link>
                  </>
                )}
                {d.quelle === 'manuell_upload' && (
                  <>
                    <span>·</span>
                    <span>von dir hochgeladen</span>
                  </>
                )}
              </div>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleDownload(d)}
              className="h-7 w-7 p-0 text-muted-foreground hover:text-foreground"
              aria-label="Herunterladen"
            >
              <HugeiconsIcon
                icon={DownloadCircle02Icon}
                size={14}
                strokeWidth={1.5}
              />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => handleDelete(d)}
              disabled={busy}
              className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
              aria-label="Datei entfernen"
            >
              <HugeiconsIcon
                icon={CancelCircleIcon}
                size={14}
                strokeWidth={1.5}
              />
            </Button>
          </div>
        ))}

        <input
          ref={fileInputRef}
          type="file"
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
          className="gap-1.5 w-full sm:w-auto"
        >
          <HugeiconsIcon
            icon={UploadCircle02Icon}
            size={14}
            strokeWidth={1.5}
          />
          Datei hochladen
        </Button>
      </CardContent>
    </Card>
  );
}
