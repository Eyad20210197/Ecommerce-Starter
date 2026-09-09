import React from 'react';
import ReactDOM from 'react-dom/client';
import { StoreProvider } from './context/StoreContext.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { CartProvider } from './context/CartContext.jsx';
import { ToastProvider } from './context/ToastContext.jsx';
import { ModalProvider } from './context/ModalContext.jsx';
import { ErrorBoundary } from './components/common/ErrorBoundary.jsx';
import { App } from './App.jsx';
import './styles/index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <StoreProvider>
        <AuthProvider>
          <CartProvider>
            <ToastProvider>
              <ModalProvider>
                <App />
              </ModalProvider>
            </ToastProvider>
          </CartProvider>
        </AuthProvider>
      </StoreProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
