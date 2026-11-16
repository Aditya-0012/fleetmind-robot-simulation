import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthShell';
import { useAuth } from '../context/AuthContext';
import { DEMO_EMAIL, DEMO_PASSWORD } from '../services/authService';

export default function Login() {
  const { login, ready } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthShell>
      <h2 className="text-2xl font-bold">Sign in</h2>
      <p className="mt-1 text-sm text-ink-400">Open the fleet control room.</p>

      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        <div>
          <label htmlFor="email" className="label">
            Email
          </label>
          <input id="email" type="email" autoComplete="email" className="input" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div>
          <label htmlFor="password" className="label">
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={show ? 'text' : 'password'}
              autoComplete="current-password"
              className="input pr-10"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button type="button" onClick={() => setShow(!show)} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-100" aria-label={show ? 'Hide password' : 'Show password'}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-sm text-signal-red">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy || !email || !password}>
          <LogIn size={16} />
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <div className="mt-5 rounded-lg border border-hull-700 bg-hull-900/70 p-3 text-xs text-ink-300">
        <p>
          Demo account: <span className="font-mono text-ink-100">{DEMO_EMAIL}</span> / <span className="font-mono text-ink-100">{DEMO_PASSWORD}</span>
        </p>
        <button
          type="button"
          className="mt-2 text-signal-cyan hover:underline disabled:opacity-50"
          disabled={!ready}
          onClick={() => {
            setEmail(DEMO_EMAIL);
            setPassword(DEMO_PASSWORD);
          }}
        >
          Fill in demo credentials
        </button>
      </div>

      <p className="mt-6 text-sm text-ink-400">
        No account yet?{' '}
        <Link to="/register" className="font-medium text-signal-cyan hover:underline">
          Create one
        </Link>
      </p>
    </AuthShell>
  );
}
