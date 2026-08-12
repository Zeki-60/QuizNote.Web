import { useState } from 'react';
import { api } from '../api';
import type { AuthResponse } from '../types';

interface Props {
  onAuthenticated: (auth: AuthResponse) => void;
}

export function AuthForm({ onAuthenticated }: Props) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);

    try {
      const auth =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(email, displayName, password);
      onAuthenticated(auth);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bir hata oluştu.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="center-box card">
      <h2 style={{ marginTop: 0 }}>{mode === 'login' ? 'Giriş yap' : 'Kayıt ol'}</h2>

      <form className="stack" onSubmit={handleSubmit}>
        <div>
          <label className="muted" htmlFor="email">E-posta</label>
          <input
            id="email"
            type="email"
            value={email}
            required
            autoComplete="email"
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        {mode === 'register' && (
          <div>
            <label className="muted" htmlFor="name">Görünen ad</label>
            <input
              id="name"
              value={displayName}
              required
              onChange={(e) => setDisplayName(e.target.value)}
            />
          </div>
        )}

        <div>
          <label className="muted" htmlFor="password">Parola</label>
          <input
            id="password"
            type="password"
            value={password}
            required
            minLength={6}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        {error && <div className="error">{error}</div>}

        <button className="primary" type="submit" disabled={busy}>
          {busy ? 'Lütfen bekleyin…' : mode === 'login' ? 'Giriş yap' : 'Kayıt ol'}
        </button>
      </form>

      <p className="muted" style={{ marginBottom: 0, fontSize: '0.9rem' }}>
        {mode === 'login' ? 'Hesabın yok mu? ' : 'Zaten hesabın var mı? '}
        <button
          style={{ background: 'none', border: 'none', color: 'var(--accent)', padding: 0 }}
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError(null);
          }}
        >
          {mode === 'login' ? 'Kayıt ol' : 'Giriş yap'}
        </button>
      </p>
    </div>
  );
}
