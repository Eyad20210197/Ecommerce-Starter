import React, { useState } from 'react';
import { useStore } from '../context/StoreContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { LogIn, ArrowRight } from 'lucide-react';

export function LoginPage({ onNavigate }) {
  const { t } = useStore();
  const { login } = useAuth();
  const { refreshCart } = useCart();
  const { notice } = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      setSubmitting(true);
      const user = await login({ email: email.trim(), password });
      await refreshCart();
      notice(t('Saved.'));

      if (user.role === 'customer') {
        onNavigate('/account');
      } else {
        onNavigate('/manage/orders');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Login failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page narrow">
      <div className="auth-card panel">
        <div className="auth-header">
          <div className="auth-icon-wrap">
            <LogIn size={24} />
          </div>
          <h1>{t('Sign in')}</h1>
          <p className="auth-subtitle">{t('Sign in to your account to manage orders and saved addresses.')}</p>
        </div>

        {errorMsg && (
          <div className="alert-box alert-error" role="alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleLogin} className="auth-form">
          <div className="form-group">
            <label className="field-label">{t('Email')}</label>
            <input 
              type="email" 
              required 
              autoComplete="email" 
              maxLength={254}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="input-field"
            />
          </div>

          <div className="form-group">
            <label className="field-label">{t('Password')}</label>
            <input 
              type="password" 
              required 
              autoComplete="current-password"
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
            />
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block"
            disabled={submitting}
          >
            <span>{submitting ? t('Loading…') : t('Sign in')}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {t('New customer?')} {' '}
            <a 
              href="#/register" 
              onClick={(e) => { e.preventDefault(); onNavigate('/register'); }}
              className="text-link"
            >
              {t('Create account')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
