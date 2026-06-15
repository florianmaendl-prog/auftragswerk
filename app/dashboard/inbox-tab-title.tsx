'use client';

import { useEffect } from 'react';

/**
 * Setzt `document.title` mit Anzahl offener Arbeit (Freigabe + Manuell
 * prüfen + Reply). Owner sieht im Browser-Tab "Auftragswerk (3)" und
 * weiß damit ohne Klick ob was zu tun ist.
 *
 * Client-Component – Effect läuft im Browser, läuft beim Wechsel auf
 * andere Tabs/Seiten in der App neu. Beim Verlassen Title zurück auf
 * die Default-Metadata-Variante, damit wir nicht "(3)" auf der Profil-
 * Seite haben.
 */
export function InboxTabTitle({ offen }: { offen: number }) {
  useEffect(() => {
    const base = 'Auftragswerk – Inbox';
    document.title = offen > 0 ? `(${offen}) ${base}` : base;

    return () => {
      // Beim Unmount (Navigation weg vom Dashboard) wieder neutralen Title.
      // Andere Seiten haben ihre eigene Metadata.
      document.title = 'Auftragswerk – Assistenz, die mitdenkt.';
    };
  }, [offen]);

  return null;
}
