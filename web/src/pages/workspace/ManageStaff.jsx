import React, { useState, useEffect, useCallback } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { useModal } from '../../context/ModalContext.jsx';
import { useToast } from '../../context/ToastContext.jsx';
import { api } from '../../lib/api.js';
import { Badge } from '../../components/common/Badge.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { Users, Plus, Edit3 } from 'lucide-react';

export function ManageStaff() {
  const { t } = useStore();
  const { openModal, closeModal } = useModal();
  const { notice } = useToast();

  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadStaff = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api('/admin/staff');
      setStaff(res.staff || []);
    } catch (err) {
      console.error('Failed to load staff', err);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStaff();
  }, [loadStaff]);

  // Add / Edit Employee Dialog
  const handleOpenStaffModal = (userToEdit = null) => {
    const isEdit = Boolean(userToEdit);

    openModal(
      isEdit ? 'Edit' : 'Add employee',
      ({ close }) => {
        const [name, setName] = useState(userToEdit?.name || '');
        const [email, setEmail] = useState(userToEdit?.email || '');
        const [password, setPassword] = useState('');
        const [role, setRole] = useState(userToEdit?.role || 'manager');
        const [active, setActive] = useState(userToEdit ? userToEdit.active : true);
        const [submitting, setSubmitting] = useState(false);
        const [error, setError] = useState('');

        const handleSubmit = async (e) => {
          e.preventDefault();
          try {
            setSubmitting(true);
            setError('');

            if (isEdit) {
              await api(`/admin/staff/${userToEdit.id}`, {
                method: 'PATCH',
                body: { role, active }
              });
            } else {
              await api('/admin/staff', {
                method: 'POST',
                body: {
                  name: name.trim(),
                  email: email.trim().toLowerCase(),
                  password,
                  role
                }
              });
            }

            await loadStaff();
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

            {isEdit ? (
              <p><strong>{userToEdit.name}</strong> ({userToEdit.email})</p>
            ) : (
              <>
                <div className="form-group">
                  <label className="field-label">{t('Full name')}</label>
                  <input 
                    type="text" 
                    required 
                    maxLength={100}
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    className="input-field" 
                  />
                </div>

                <div className="form-group">
                  <label className="field-label">{t('Email')}</label>
                  <input 
                    type="email" 
                    required 
                    maxLength={254}
                    value={email} 
                    onChange={e => setEmail(e.target.value)} 
                    className="input-field" 
                  />
                </div>

                <div className="form-group">
                  <label className="field-label">{t('Password')}</label>
                  <input 
                    type="password" 
                    required 
                    minLength={12} 
                    maxLength={128}
                    autoComplete="new-password"
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    className="input-field" 
                  />
                  <span className="field-hint">{t('At least 12 characters')}</span>
                </div>
              </>
            )}

            <div className="form-group">
              <label className="field-label">{t('Role')}</label>
              <select 
                value={role} 
                onChange={e => setRole(e.target.value)}
                className="input-field"
              >
                <option value="manager">{t('manager')}</option>
                <option value="warehouse">{t('warehouse')}</option>
              </select>
            </div>

            {isEdit && (
              <div className="form-group">
                <label className="checkbox-label">
                  <input 
                    type="checkbox" 
                    checked={active} 
                    onChange={e => setActive(e.target.checked)} 
                  />
                  <span>{t('Active')}</span>
                </label>
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

  return (
    <div className="workspace-subpage">
      <div className="page-top">
        <h1>{t('Employees')}</h1>
        <button 
          className="btn btn-primary btn-small"
          onClick={() => handleOpenStaffModal()}
        >
          <Plus size={16} />
          <span>{t('Add employee')}</span>
        </button>
      </div>

      {loading ? (
        <p className="loading-text">{t('Loading…')}</p>
      ) : staff.length > 0 ? (
        <div className="table-card panel">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>{t('Name')}</th>
                  <th>{t('Email')}</th>
                  <th>{t('Role')}</th>
                  <th>{t('Status')}</th>
                  <th>{t('Action')}</th>
                </tr>
              </thead>
              <tbody>
                {staff.map(u => (
                  <tr key={u.id}>
                    <td><strong>{u.name}</strong></td>
                    <td className="muted-cell">{u.email}</td>
                    <td>{t(u.role)}</td>
                    <td>
                      <Badge 
                        status={u.active ? 'completed' : 'cancelled'} 
                        label={t(u.active ? 'Enabled' : 'Disabled')} 
                      />
                    </td>
                    <td>
                      {u.role !== 'owner' ? (
                        <button 
                          className="btn btn-secondary btn-small"
                          onClick={() => handleOpenStaffModal(u)}
                          title={t('Edit')}
                        >
                          <Edit3 size={14} />
                          <span>{t('Edit')}</span>
                        </button>
                      ) : (
                        <span className="muted-small">—</span>
                      )}
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
          subtitle="Add store employees to delegate manager and warehouse tasks."
          icon={<Users size={48} />}
        />
      )}
    </div>
  );
}
