import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { useModal } from '../../context/ModalContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../lib/api.js';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { Plus, Edit3, Trash2, FolderTree } from 'lucide-react';

export function ManageCategories() {
  const { storeConfig, t } = useStore();
  const { openModal, closeModal } = useModal();
  const { notice } = useToast();

  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/catalog/categories');
      setCategories(res.categories || []);
    } catch (err) {
      console.error('Failed to load categories', err);
      setCategories([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCategories();
  }, [loadCategories]);

  // Add / Edit Category Dialog
  const handleOpenCategoryModal = (catToEdit = null) => {
    const isEdit = Boolean(catToEdit);

    openModal(
      isEdit ? 'Edit' : 'New category',
      ({ close }) => {
        const [name, setName] = useState(catToEdit?.name || '');
        const [slug, setSlug] = useState(catToEdit?.slug || '');
        const [arName, setArName] = useState(catToEdit?.translations?.ar || '');
        const [submitting, setSubmitting] = useState(false);
        const [error, setError] = useState('');

        const handleSubmit = async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            setError('');

            const body = {
              name: name.trim(),
              slug: slug.trim().toLowerCase(),
              translations: arName ? { ar: arName.trim() } : {}
            };

            if (isEdit) {
              await api(`/catalog/categories/${catToEdit.id}`, { method: 'PATCH', body });
            } else {
              await api('/catalog/categories', { method: 'POST', body });
            }

            await loadCategories();
            notice(t('Saved.'));
            close();
          } catch (err) {
            setError(err.message);
          } finally {
            setSubmitting(false);
          }
        };

        return (
          <form onSubmit={handleSubmit} className="stack">
            {error && <div className="alert-box alert-error">{error}</div>}

            <div className="form-group">
              <label className="field-label">{t('Name')}</label>
              <input 
                type="text" 
                required 
                maxLength={80}
                value={name} 
                onChange={e => {
                  setName(e.target.value);
                  if (!isEdit && !slug) {
                    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''));
                  }
                }} 
                className="input-field" 
              />
            </div>

            <div className="form-group">
              <label className="field-label">{t('Slug')}</label>
              <input 
                type="text" 
                required 
                pattern="[a-z0-9]+(-[a-z0-9]+)*"
                maxLength={80}
                value={slug} 
                onChange={e => setSlug(e.target.value.toLowerCase())} 
                className="input-field mono" 
              />
            </div>

            {storeConfig.features.multiLanguage && (
              <div className="form-group">
                <label className="field-label">{t('Arabic name')}</label>
                <input 
                  type="text" 
                  maxLength={80}
                  value={arName} 
                  onChange={e => setArName(e.target.value)} 
                  className="input-field" 
                />
              </div>
            )}

            <div className="modal-actions">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {t('Save')}
              </button>
              <button type="button" className="btn btn-secondary" onClick={close}>
                {t('Cancel')}
              </button>
            </div>
          </form>
        );
      }
    );
  };

  // Delete Category confirmation
  const handleDeleteCategory = (id) => {
    openModal(
      'Delete',
      ({ close }) => (
        <div className="stack">
          <p>{t('Are you sure you want to delete this category? Products in this category will become unassigned.')}</p>
          <div className="modal-actions">
            <button 
              className="btn btn-danger"
              onClick={async () => {
                try {
                  await api(`/catalog/categories/${id}`, { method: 'DELETE' });
                  await loadCategories();
                  notice(t('Saved.'));
                  close();
                } catch (err) {
                  notice(err.message, true);
                }
              }}
            >
              {t('Delete')}
            </button>
            <button className="btn btn-secondary" onClick={close}>
              {t('Cancel')}
            </button>
          </div>
        </div>
      )
    );
  };

  return (
    <div className="workspace-subpage">
      <div className="page-top">
        <h1>{t('Categories')}</h1>
        <button 
          className="btn btn-primary btn-small"
          onClick={() => handleOpenCategoryModal()}
        >
          <Plus size={16} />
          <span>{t('New category')}</span>
        </button>
      </div>

      {loading ? (
        <p className="loading-text">{t('Loading…')}</p>
      ) : categories.length > 0 ? (
        <div className="table-card panel">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Name')}</th>
                  <th>{t('Slug')}</th>
                  {storeConfig.features.multiLanguage && <th>{t('Arabic name')}</th>}
                  <th>{t('Action')}</th>
                </tr>
              </thead>
              <tbody>
                {categories.map(c => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td className="mono">{c.slug}</td>
                    {storeConfig.features.multiLanguage && (
                      <td>{c.translations?.ar || '—'}</td>
                    )}
                    <td>
                      <div className="table-actions">
                        <button 
                          className="btn btn-secondary btn-small"
                          onClick={() => handleOpenCategoryModal(c)}
                          title={t('Edit')}
                        >
                          <Edit3 size={14} />
                          <span>{t('Edit')}</span>
                        </button>
                        <button 
                          className="btn btn-danger btn-small"
                          onClick={() => handleDeleteCategory(c.id)}
                          title={t('Delete')}
                        >
                          <Trash2 size={14} />
                          <span>{t('Delete')}</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState 
          title="Nothing to show yet."
          subtitle="Create categories to organize your store catalog."
          icon={<FolderTree size={48} />}
        />
      )}
    </div>
  );
}
