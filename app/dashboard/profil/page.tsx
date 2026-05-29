import { createClient } from '@/lib/supabase-server';
import { Card } from '@/components/ui/card';
import { ProfilForm } from './profil-form';
import { GmailConnectionCard } from './gmail-connection-card';

export default async function ProfilPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('betrieb_id, rolle')
    .eq('id', user.id)
    .single();

  if (!profile?.betrieb_id) {
    return (
      <div className="container mx-auto py-6 sm:py-8 px-4 sm:px-6 max-w-3xl">
        <Card className="p-12 text-center">
          <p className="text-muted-foreground text-sm">
            Kein Betrieb verknüpft. Bitte Admin kontaktieren.
          </p>
        </Card>
      </div>
    );
  }

  const [{ data: betrieb, error }, { data: gmailConn }] = await Promise.all([
    supabase
      .from('betriebe')
      .select(
        'id, name, inhaber, branche, inbound_email, region, mindestauftragswert, was_wir_machen, was_wir_nicht_machen, wichtige_kunden, signatur, ton_beispiele'
      )
      .eq('id', profile.betrieb_id)
      .single(),
    supabase
      .from('gmail_connections')
      .select('google_email, status, letzter_fehler')
      .eq('betrieb_id', profile.betrieb_id)
      .maybeSingle(),
  ]);

  if (error || !betrieb) {
    return (
      <div className="container mx-auto py-6 sm:py-8 px-4 sm:px-6 max-w-3xl">
        <Card className="p-12 text-center">
          <p className="text-destructive text-sm">
            Fehler beim Laden: {error?.message || 'Betrieb nicht gefunden'}
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 sm:py-8 px-4 sm:px-6 max-w-3xl">
      <div className="mb-8">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-wide mb-1">
          Betriebsprofil
        </h1>
        <p className="text-muted-foreground text-sm">
          Diese Daten fließen in jede KI-Antwort. Je präziser hier gepflegt, desto
          besser werden die Entwürfe.
        </p>
      </div>

      <div className="mb-6">
        <GmailConnectionCard
          initial={
            gmailConn
              ? {
                  google_email: gmailConn.google_email,
                  status: gmailConn.status as 'aktiv' | 'fehler' | 'widerrufen',
                  letzter_fehler: gmailConn.letzter_fehler,
                }
              : null
          }
        />
      </div>

      <ProfilForm
        betriebId={betrieb.id}
        initialData={{
          name: betrieb.name || '',
          inhaber: betrieb.inhaber || '',
          branche: betrieb.branche || '',
          inbound_email: betrieb.inbound_email || '',
          region: betrieb.region || '',
          mindestauftragswert: betrieb.mindestauftragswert,
          was_wir_machen: betrieb.was_wir_machen || [],
          was_wir_nicht_machen: betrieb.was_wir_nicht_machen || [],
          wichtige_kunden: betrieb.wichtige_kunden || [],
          signatur: betrieb.signatur || '',
          ton_beispiele: betrieb.ton_beispiele || [],
        }}
      />
    </div>
  );
}