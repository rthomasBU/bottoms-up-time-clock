import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../lib/supabaseClient';
import { useAuth } from '../../hooks/useAuth';
import { Topbar } from '../../components/layout/Topbar';

export function LoginPage() {
  const { session, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  if (!loading && session) return <Navigate to="/" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) setError(error.message);
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email above first, then click "Forgot password?".');
      return;
    }
    setError(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) setError(error.message);
    else setResetSent(true);
  }

  return (
    <>
      <Topbar />
      <div className="login-screen">
        <div className="login-card">
          <h1>
            Time <span>Clock</span>
          </h1>
          <form onSubmit={(e) => void handleSubmit(e)}>
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {error && <p className="form-error">{error}</p>}
            {resetSent && <p className="form-success">Password reset email sent, check your inbox.</p>}
            <button type="submit" className="btn-build" disabled={submitting}>
              {submitting ? 'Signing in...' : 'Sign in'}
            </button>
            <button type="button" className="btn-clear" onClick={() => void handleForgotPassword()}>
              Forgot password?
            </button>
          </form>
          <p className="form-hint">Don't have an account? Ask your admin to create one for you.</p>
        </div>
      </div>
    </>
  );
}
