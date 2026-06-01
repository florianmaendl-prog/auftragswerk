'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Footer } from '@/components/brand/footer';

/**
 * Self-Service-Signup (Welle G). User füllt Email + Passwort +
 * Betriebsname + Inhaber + Branche aus. Daten gehen via
 * `options.data` an supabase.auth.signUp und landen in
 * raw_user_meta_data. Der DB-Trigger `handle_new_user` (Migration
 * 20260601_signup_trigger.sql) legt automatisch betriebe + profiles
 * inkl. Subdomain-Slug an.
 *
 * Nach Signup zeigt die Seite eine "Bestätige deine Mail"-Anzeige.
 * Confirmation-Link führt über /auth/callback in die App, beim ersten
 * Login greift die Wow-Onboarding-First-Run-Detection.
 */
export default function RegistrierenPage() {
  const [email, setEmail] = useState('');
  const [passwort, setPasswort] = useState('');
  const [betriebsname, setBetriebsname] = useState('');
  const [inhaber, setInhaber] = useState('');
  const [branche, setBranche] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isDone, setIsDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;
    setIsLoading(true);
    setErrorMsg('');

    const supabase = createClient();
    const { error } = await supabase.auth.signUp({
      email,
      password: passwort,
      options: {
        emailRedirectTo: 'https://auftragswerk.app/auth/callback?next=/dashboard',
        data: {
          betriebsname: betriebsname.trim(),
          inhaber: inhaber.trim(),
          branche: branche.trim(),
        },
      },
    });

    if (error) {
      setIsLoading(false);
      if (error.message.includes('already registered')) {
        setErrorMsg(
          'Diese Email ist bereits registriert. Probier dich anzumelden oder nutze „Passwort vergessen".'
        );
      } else if (error.message.toLowerCase().includes('password')) {
        setErrorMsg('Passwort muss mindestens 6 Zeichen haben.');
      } else {
        setErrorMsg(error.message);
      }
      return;
    }

    setIsLoading(false);
    setIsDone(true);
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <div className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold tracking-tighter uppercase mb-2">
              Auftragswerk
            </h1>
            <p className="text-muted-foreground">
              Die Büroassistenz fürs Handwerk.
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {isDone ? 'Fast geschafft' : 'Account erstellen'}
              </CardTitle>
              <CardDescription>
                {isDone
                  ? 'Wir haben dir einen Bestätigungs-Link geschickt.'
                  : 'In 30 Sekunden eingerichtet. Danach kannst du direkt loslegen.'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isDone ? (
                <div className="space-y-4 text-sm">
                  <p>
                    ✓ Bestätigungs-Link an <strong>{email}</strong> geschickt.
                  </p>
                  <p className="text-muted-foreground">
                    Schau in dein Postfach (auch Spam-Ordner) und klick auf
                    den Link. Danach geht's direkt ins Dashboard.
                  </p>
                  <Link
                    href="/login"
                    className="block text-center text-muted-foreground hover:text-foreground underline-offset-4 hover:underline pt-2"
                  >
                    Zurück zum Login
                  </Link>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="betriebsname">Betriebsname</Label>
                    <Input
                      id="betriebsname"
                      type="text"
                      placeholder="z.B. Bauelemente Rapp"
                      value={betriebsname}
                      onChange={(e) => setBetriebsname(e.target.value)}
                      required
                      disabled={isLoading}
                      maxLength={120}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="inhaber">Inhaber / Ansprechpartner</Label>
                    <Input
                      id="inhaber"
                      type="text"
                      placeholder="Vorname Nachname"
                      value={inhaber}
                      onChange={(e) => setInhaber(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="name"
                      maxLength={120}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="branche">Branche</Label>
                    <Input
                      id="branche"
                      type="text"
                      placeholder="z.B. Schreinerei, Maler, Elektro"
                      value={branche}
                      onChange={(e) => setBranche(e.target.value)}
                      required
                      disabled={isLoading}
                      maxLength={80}
                    />
                  </div>

                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label htmlFor="email">Deine Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="deine@email.de"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="passwort">Passwort</Label>
                    <Input
                      id="passwort"
                      type="password"
                      placeholder="mindestens 6 Zeichen"
                      value={passwort}
                      onChange={(e) => setPasswort(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="new-password"
                      minLength={6}
                    />
                  </div>

                  {errorMsg && (
                    <p className="text-sm text-destructive">{errorMsg}</p>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? 'Account wird erstellt...' : 'Account erstellen'}
                  </Button>

                  <p className="text-xs text-muted-foreground text-center leading-relaxed pt-1">
                    Mit dem Klick auf „Account erstellen" akzeptierst du die{' '}
                    <Link
                      href="/agb"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      AGB
                    </Link>{' '}
                    und die{' '}
                    <Link
                      href="/datenschutz"
                      className="underline underline-offset-2 hover:text-foreground"
                    >
                      Datenschutzerklärung
                    </Link>
                    .
                  </p>

                  <p className="text-sm text-center text-muted-foreground pt-2 border-t border-border">
                    Schon einen Account?{' '}
                    <Link
                      href="/login"
                      className="text-foreground underline underline-offset-2 hover:no-underline"
                    >
                      Anmelden
                    </Link>
                  </p>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
      <Footer />
    </div>
  );
}
