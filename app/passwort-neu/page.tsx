'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PasswortNeuPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [passwordWiederholung, setPasswordWiederholung] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Supabase setzt automatisch eine Recovery-Session beim Klick auf den Mail-Link
    // Wir prüfen ob ein User existiert (nur während Recovery-Flow gültig)
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;

    if (password.length < 6) {
      setErrorMsg('Passwort muss mindestens 6 Zeichen haben.');
      return;
    }

    if (password !== passwordWiederholung) {
      setErrorMsg('Passwörter stimmen nicht überein.');
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setIsLoading(false);
      setErrorMsg(error.message);
      return;
    }

    // Erfolgreich gespeichert → Dashboard
    router.push('/dashboard');
    router.refresh();
  }

  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <p className="text-sm text-muted-foreground">Wird geladen...</p>
      </div>
    );
  }

  if (isAuthenticated === false) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader>
              <CardTitle>Link abgelaufen</CardTitle>
              <CardDescription>
                Der Link zum Zurücksetzen ist nicht mehr gültig. Bitte fordere einen neuen an.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Link
                href="/passwort-vergessen"
                className="text-sm text-foreground underline-offset-4 hover:underline"
              >
                Neuen Link anfordern
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tighter uppercase mb-2">Auftragswerk</h1>
          <p className="text-muted-foreground">Die Büroassistenz fürs Handwerk.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Neues Passwort</CardTitle>
            <CardDescription>
              Bitte wähle ein neues Passwort (mindestens 6 Zeichen).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">Neues Passwort</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password-wiederholung">Passwort wiederholen</Label>
                <Input
                  id="password-wiederholung"
                  type="password"
                  placeholder="••••••••"
                  value={passwordWiederholung}
                  onChange={(e) => setPasswordWiederholung(e.target.value)}
                  required
                  disabled={isLoading}
                  autoComplete="new-password"
                  minLength={6}
                />
              </div>

              {errorMsg && (
                <p className="text-sm text-destructive">{errorMsg}</p>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? 'Speichern...' : 'Passwort speichern'}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}