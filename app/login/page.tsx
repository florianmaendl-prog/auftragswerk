'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase-browser';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus('sending');
    setErrorMsg('');

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setStatus('error');
      setErrorMsg(error.message);
    } else {
      setStatus('sent');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold tracking-tighter uppercase mb-2">Auftragswerk</h1>
          <p className="text-muted-foreground">Assistenz, die mitdenkt.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Anmelden</CardTitle>
            <CardDescription>
              Wir schicken dir einen Link per E-Mail. Kein Passwort nötig.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {status === 'sent' ? (
              <div className="space-y-2">
                <p className="text-sm">
                  ✓ Link an <strong>{email}</strong> geschickt.
                </p>
                <p className="text-sm text-muted-foreground">
                  Schau in dein Postfach (auch Spam-Ordner) und klick auf den Link.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <Input
                  type="email"
                  placeholder="deine@email.de"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={status === 'sending'}
                />
                <Button type="submit" className="w-full" disabled={status === 'sending'}>
                  {status === 'sending' ? 'Wird gesendet...' : 'Link per E-Mail schicken'}
                </Button>
                {status === 'error' && (
                  <p className="text-sm text-destructive">Fehler: {errorMsg}</p>
                )}
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}