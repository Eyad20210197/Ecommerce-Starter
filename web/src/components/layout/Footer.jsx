import React from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { ShieldCheck, Mail, Code2 } from 'lucide-react';

export function Footer() {
  const { storeConfig, backendConfig, t } = useStore();
  const brand = storeConfig.brand;
  const supportEmail = backendConfig?.email || brand.supportEmail;

  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <div className="footer-left">
          <span>{`Copyright ${new Date().getFullYear()}`}</span>
          <span className="footer-separator">·</span>
          <span>{brand.name}</span>
        </div>
        <div className="footer-right">
          {storeConfig.features.cashOnDelivery && (
            <span className="footer-badge">
              <ShieldCheck size={16} />
              <span>{t('Cash on delivery')}</span>
            </span>
          )}
          {supportEmail && (
            <a href={`mailto:${supportEmail}`} className="footer-email">
              <Mail size={16} />
              <span>{t('Support')}</span>
            </a>
          )}
          <a href={storeConfig.developer.website} className="footer-email" target="_blank" rel="noopener noreferrer">
            <Code2 size={16} />
            <span>{storeConfig.developer.label}</span>
          </a>
        </div>
      </div>
    </footer>
  );
}
