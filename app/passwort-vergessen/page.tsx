'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function PasswortVergessenPage() {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isLoading) return;

    setIsLoading(true);
    setErrorMsg('');

    const supabase = createClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/passwort-neu`,
    });

    if (error) {
      setIsLoading(false);
      setErrorMsg(error.message);
      return;
    }

    setIsLoading(false);
    setIsSent(true);
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
            <CardTitle>Passwort vergessen?</CardTitle>
            <CardDescription>
              {isSent
                ? 'Wir haben dir einen Link geschickt.'
                : 'Gib deine Email ein. Wir schicken dir einen Link zum Zurücksetzen.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isSent ? (
              <div className="space-y-4">
                <p className="text-sm">
                  ✓ Reset-Link an <strong>{email}</strong> geschickt.
                </p>
                <p className="text-sm text-muted-foreground">
                  Schau in dein Postfach (auch Spam-Ordner) und klick auf den Link.
                </p>
                <Link
                  href="/login"
                  className="block text-center text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline mt-4"
                >
                  Zurück zum Login
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
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

                {errorMsg && (
                  <p className="text-sm text-destructive">{errorMsg}</p>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Wird gesendet...' : 'Reset-Link senden'}
                </Button>

                <Link
                  href="/login"
                  className="block text-center text-sm text-muted-foreground hover:text-foreground underline-offset-4 hover:underline"
                >
                  Zurück zum Login
                </Link>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}