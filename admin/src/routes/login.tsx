import { useEffect, useRef, useState } from 'react';
import { Flame, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent } from '@/components/ui/card';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export function Login() {
  const auth = useAuth();
  const { signInWithGoogle } = auth;
  const error = auth.status === 'signed-out' ? auth.error : undefined;
  const buttonRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);

  useEffect(() => {
    const check = setInterval(() => {
      if (window.google?.accounts?.id) {
        setScriptReady(true);
        clearInterval(check);
      }
    }, 100);
    return () => clearInterval(check);
  }, []);

  useEffect(() => {
    if (!scriptReady || !buttonRef.current || !CLIENT_ID) return;

    window.google!.accounts.id.initialize({
      client_id: CLIENT_ID,
      callback: (response) => signInWithGoogle(response.credential),
    });
    window.google!.accounts.id.renderButton(buttonRef.current, {
      theme: 'outline',
      size: 'large',
      width: 280,
      text: 'signin_with',
    });
  }, [scriptReady, signInWithGoogle]);

  return (
    <div className="flex h-screen items-center justify-center bg-muted/40 px-4">
      <Card className="w-full max-w-sm">
        <CardContent className="flex flex-col items-center gap-6 py-10">
          <div className="flex items-center gap-2">
            <Flame className="h-6 w-6 text-chart-3" />
            <span className="text-lg font-semibold">HariHariBol Admin</span>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Sign in with the Google account tied to your admin role.
          </p>

          {!CLIENT_ID && (
            <div className="flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 p-3 text-xs text-warning-foreground">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                <code className="font-mono">VITE_GOOGLE_CLIENT_ID</code> is not set. Add it to{' '}
                <code className="font-mono">admin/.env</code> to enable sign-in.
              </span>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div ref={buttonRef} />
        </CardContent>
      </Card>
    </div>
  );
}
