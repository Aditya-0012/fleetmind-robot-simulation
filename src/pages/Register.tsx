import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthShell } from '../components/auth/AuthShell';
import { useAuth } from '../context/AuthContext';
import { validateEmail, validatePassword } from '../services/authService';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', role: '', password: '', confirm: '' });
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const errors = {
    name: form.name.trim() ? null : 'Enter your name',
    email: validateEmail(form.email),
    password: validatePassword(form.password),
    confirm: form.confirm === form.password ? null : 'Passwords do not match',
  };
  const valid = Object.values(errors).every((e) => e === null);

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });
  const blur = (k: string) => () => setTouched({ ...touched, [k]: true });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setTouched({ name: true, email: true, password: true, confirm: true });
    if (!valid) return;
    setBusy(true);
    setError(null);
    try {
      await register({ name: form.name, email: form.email, password: form.password, role: form.role });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the account');
    } finally {
      setBusy(false);
    }
  };

  const field = (k: 'name' | 'email' | 'password' | 'confirm', label: string, type = 'text', auto?: string) => (
    <div>
      <label htmlFor={k} className="label">
        {label}
      </label>
      <input id={k} type={type} autoComplete={auto} className="input" value={form[k]} onChange={set(k)} onBlur={blur(k)} aria-invalid={!!(touched[k] && errors[k])} />
      {touched[k] && errors[k] && <p className="mt-1 text-xs text-signal-red">{errors[k]}</p>}
    </div>
  );

  return (
    <AuthShell>
      <h2 className="text-2xl font-bold">Create an account</h2>
      <p className="mt-1 text-sm text-ink-400">Accounts are stored in this browser only.</p>
      <form onSubmit={submit} className="mt-7 space-y-4" noValidate>
        {field('name', 'Full name', 'text', 'name')}
        {field('email', 'Email', 'email', 'email')}
        <div>
          <label htmlFor="role" className="label">
            Role <span className="text-ink-400">(optional)</span>
          </label>
          <input id="role" className="input" placeholder="Fleet operator" value={form.role} onChange={set('role')} />
        </div>
        {field('password', 'Password', 'password', 'new-password')}
        {field('confirm', 'Confirm password', 'password', 'new-password')}
        {error && (
          <p role="alert" className="rounded-lg border border-signal-red/40 bg-signal-red/10 px-3 py-2 text-sm text-signal-red">
            {error}
          </p>
        )}
        <button type="submit" className="btn-primary w-full py-2.5" disabled={busy}>
          <UserPlus size={16} />
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-sm text-ink-400">
        Already registered?{' '}
        <Link to="/login" className="font-medium text-signal-cyan hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  );
}
