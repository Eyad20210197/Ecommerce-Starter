import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';
import { useStore } from './StoreContext.jsx';
import { digits } from '../lib/formatters.js';
import { starterProducts } from '../config/starterCatalog.js';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const saved = localStorage.getItem('aura_cart_items');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const { user } = useAuth();
  const { backendConfig, currency, storeConfig } = useStore();

  const syncLocalCart = (newItems) => {
    setItems(newItems);
    try {
      localStorage.setItem('aura_cart_items', JSON.stringify(newItems));
    } catch {
      // Storage error
    }
  };

  const refreshCart = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/cart');
      if (res?.items) {
        syncLocalCart(res.items);
      }
    } catch (err) {
      console.warn('Cart refresh notice (using local cart):', err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload cart when user identity changes (guest -> registered or logout)
  useEffect(() => {
    refreshCart();
  }, [user, refreshCart]);

  const cartCount = useMemo(() => {
    return items.reduce((sum, item) => sum + (item.quantity || 0), 0);
  }, [items]);

  const addToCart = useCallback(async (productId, quantityToAdd = 1) => {
    const existing = items.find(i => (i.product_id || i.id) === productId);
    const newQty = (existing?.quantity || 0) + quantityToAdd;

    try {
      const res = await api(`/cart/items/${productId}`, {
        method: 'PUT',
        body: { quantity: newQty }
      });
      if (res?.items) {
        syncLocalCart(res.items);
        return res.items;
      }
    } catch (err) {
      console.warn('Cart add notice (using local cart):', err.message);
    }

    // Local fallback
    const product = starterProducts.find(p => p.id === productId);
    let updated;
    if (existing) {
      updated = items.map(i => (i.product_id || i.id) === productId ? { ...i, quantity: newQty } : i);
    } else {
      updated = [...items, {
        product_id: productId,
        id: productId,
        name: product?.name || 'Product',
        price_minor: product?.price_minor || 2400,
        image_url: product?.image_url || '',
        quantity: quantityToAdd,
        available: product?.available || 20,
        active: true
      }];
    }
    syncLocalCart(updated);
    return updated;
  }, [items]);

  const updateQuantity = useCallback(async (productId, quantity) => {
    const qty = Number(quantity);
    try {
      const res = await api(`/cart/items/${productId}`, {
        method: 'PUT',
        body: { quantity: qty }
      });
      if (res?.items) {
        syncLocalCart(res.items);
        return res.items;
      }
    } catch (err) {
      console.warn('Cart update notice (using local cart):', err.message);
    }

    let updated;
    if (qty <= 0) {
      updated = items.filter(i => (i.product_id || i.id) !== productId);
    } else {
      updated = items.map(i => (i.product_id || i.id) === productId ? { ...i, quantity: qty } : i);
    }
    syncLocalCart(updated);
    return updated;
  }, [items]);

  const removeFromCart = useCallback(async (productId) => {
    return updateQuantity(productId, 0);
  }, [updateQuantity]);

  // Calculate pricing breakdown in currently selected currency
  const summary = useMemo(() => {
    if (!backendConfig) {
      return { subtotalMinor: 0, shippingMinor: 0, taxMinor: 0, totalMinor: 0 };
    }

    const baseCurr = backendConfig.currency || 'USD';
    const rates = backendConfig.currencies || { [baseCurr]: 1 };
    const rate = (rates[currency] || 1) / (rates[baseCurr] || 1);
    const targetDigits = digits(currency);
    const baseDigits = digits(baseCurr);
    const multiplier = 10 ** (targetDigits - baseDigits);

    const subtotalMinor = items.reduce((sum, item) => {
      const convertedPrice = Math.round(item.price_minor * rate * multiplier);
      return sum + (convertedPrice * item.quantity);
    }, 0);

    const shippingMinor = Math.round((backendConfig.shippingFeeMinor || 0) * rate * multiplier);
    const taxBps = backendConfig.taxBps || 0;
    const taxMinor = Math.round((subtotalMinor * taxBps) / 10000);
    const totalMinor = subtotalMinor + shippingMinor + taxMinor;

    return { subtotalMinor, shippingMinor, taxMinor, totalMinor };
  }, [items, backendConfig, currency]);

  const hasUnavailableItems = useMemo(() => {
    return items.some(item => !item.active || (item.available !== undefined && item.available < item.quantity));
  }, [items]);

  const value = {
    items,
    cartCount,
    loading,
    refreshCart,
    addToCart,
    updateQuantity,
    removeFromCart,
    summary,
    hasUnavailableItems
  };

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within CartProvider');
  return context;
}
