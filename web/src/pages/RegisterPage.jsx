import React, { useState } from 'react';
import { useStore } from '../context/StoreContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { UserPlus, ArrowRight } from 'lucide-react';

export function RegisterPage({ onNavigate }) {
  const { t } = useStore();
  const { register } = useAuth();
  const { refreshCart } = useCart();
  const { notice } = useToast();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    try {
      setSubmitting(true);
      const user = await register({
        name: name.trim(),
        email: email.trim(),
        password
      });
      await refreshCart();
      notice(t('Saved.'));

      if (user.role === 'customer') {
        onNavigate('/account');
      } else {
        onNavigate('/manage/orders');
      }
    } catch (err) {
      setErrorMsg(err.message || 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="container-page narrow">
      <div className="auth-card panel">
        <div className="auth-header">
          <div className="auth-icon-wrap">
            <UserPlus size={24} />
          </div>
          <h1>{t('Create account')}</h1>
          <p className="auth-subtitle">{t('Create an account to track orders and save shipping addresses.')}</p>
        </div>

        {errorMsg && (
          <div className="alert-box alert-error" role="alert">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="auth-form">
          <div className="form-group">
            <label className="field-label">{t('Full name')}</label>
            <input 
              type="text" 
              required 
              autoComplete="name" 
              minLength={2}
              maxLength={100}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alex Smith"
              className="input-field"
            />
          </div>

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
              autoComplete="new-password"
              minLength={12}
              maxLength={128}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="input-field"
            />
            <span className="field-hint">{t('At least 12 characters')}</span>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary btn-block"
            disabled={submitting}
          >
            <span>{submitting ? t('Loading…') : t('Create account')}</span>
            <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-footer">
          <p>
            {t('Already have an account?')} {' '}
            <a 
              href="#/login" 
              onClick={(e) => { e.preventDefault(); onNavigate('/login'); }}
              className="text-link"
            >
              {t('Sign in')}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
