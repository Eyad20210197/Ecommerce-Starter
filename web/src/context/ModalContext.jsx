import React, { createContext, useContext, useState, useCallback } from 'react';
import { X } from 'lucide-react';

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modalState, setModalState] = useState(null);

  const openModal = useCallback((title, content) => {
    setModalState({ title, content });
  }, []);

  const closeModal = useCallback(() => {
    setModalState(null);
  }, []);

  return (
    <ModalContext.Provider value={{ openModal, closeModal }}>
      {children}
      {modalState && (
        <div className="modal-backdrop" onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}>
          <div className="modal-window" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <div className="modal-header">
              <h2 id="modal-title">{modalState.title}</h2>
              <button className="modal-close" onClick={closeModal} aria-label="Close dialog">
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {typeof modalState.content === 'function' ? (
                React.createElement(modalState.content, { close: closeModal })
              ) : (
                modalState.content
              )}
            </div>
          </div>
        </div>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModal must be used within ModalProvider');
  return context;
}
