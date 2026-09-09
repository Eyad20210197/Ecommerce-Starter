import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../../context/StoreContext.jsx';
import { uploadToImageKit, isImageKitUrl, buildImageUrl } from '../../lib/imagekit.js';
import { 
  UploadCloud, 
  Image as ImageIcon, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw, 
  Link as LinkIcon, 
  FileCheck 
} from 'lucide-react';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif'];

export function ImageKitUploader({
  value = '',
  onChange,
  folder = '/products',
  label = 'Product photo',
  className = ''
}) {
  const { t } = useStore();
  const fileInputRef = useRef(null);

  const [isDragging, setIsDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(value || '');
  const [error, setError] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [manualInput, setManualInput] = useState(value || '');

  // Keep preview in sync with external value changes
  useEffect(() => {
    setPreviewUrl(value || '');
    setManualInput(value || '');
  }, [value]);

  const handleFile = async (file) => {
    if (!file) return;

    // 1. Validation
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError(t('Please select a valid image file (JPEG, PNG, WebP, AVIF).'));
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(t('Image size exceeds 10MB limit. Please choose a smaller photo.'));
      return;
    }

    setError('');
    
    // 2. Instant local preview
    const localUrl = URL.createObjectURL(file);
    setPreviewUrl(localUrl);
    setUploading(true);
    setProgress(0);

    try {
      // 3. Upload to ImageKit
      const result = await uploadToImageKit(file, {
        folder,
        onProgress: (pct) => setProgress(pct)
      });

      // 4. Update with cloud URL
      const cloudUrl = result.url;
      setPreviewUrl(cloudUrl);
      setManualInput(cloudUrl);
      if (onChange) onChange(cloudUrl);
    } catch (err) {
      console.error('ImageKit upload error:', err);
      setError(err.message || t('Failed to upload image.'));
      // If error occurs, keep local preview or revert
    } finally {
      setUploading(false);
      // Clean up object URL after upload or error
      setTimeout(() => URL.revokeObjectURL(localUrl), 10000);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleManualApply = () => {
    setError('');
    const trimmed = manualInput.trim();
    setPreviewUrl(trimmed);
    if (onChange) onChange(trimmed);
  };

  const handleRemove = (e) => {
    e.stopPropagation();
    setPreviewUrl('');
    setManualInput('');
    setError('');
    if (onChange) onChange('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const isCloudHosted = previewUrl && isImageKitUrl(previewUrl);

  return (
    <div className={`imagekit-uploader ${className}`}>
      <div className="imagekit-uploader-header">
        <label className="field-label">{t(label)}</label>
        <button
          type="button"
          className="text-btn-toggle"
          onClick={() => setManualMode(!manualMode)}
        >
          {manualMode ? (
            <>
              <UploadCloud size={13} />
              <span>{t('Upload mode')}</span>
            </>
          ) : (
            <>
              <LinkIcon size={13} />
              <span>{t('Paste URL')}</span>
            </>
          )}
        </button>
      </div>

      {manualMode ? (
        <div className="manual-url-box">
          <div className="manual-url-input-wrap">
            <input
              type="url"
              placeholder="https://..."
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              className="input-field"
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleManualApply}
            >
              {t('Apply')}
            </button>
          </div>
          <span className="field-help-text">
            {t('You can paste an existing HTTPS image link or switch back to upload.')}
          </span>
        </div>
      ) : (
        <>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            style={{ display: 'none' }}
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                handleFile(e.target.files[0]);
              }
            }}
          />

          {previewUrl ? (
            <div className="imagekit-preview-container">
              <div className="imagekit-preview-wrapper">
                <img
                  src={isCloudHosted ? buildImageUrl(previewUrl, { width: 400, height: 400 }) : previewUrl}
                  alt={t('Product preview')}
                  className="imagekit-preview-img"
                />

                {uploading && (
                  <div className="imagekit-uploading-overlay">
                    <RefreshCw size={24} className="animate-spin text-white mb-2" />
                    <div className="upload-progress-text">{t('Uploading to Cloud...')} {progress}%</div>
                    <div className="upload-progress-bar-bg">
                      <div 
                        className="upload-progress-bar-fill" 
                        style={{ width: `${progress}%` }} 
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="imagekit-preview-meta">
                <div className="imagekit-meta-badge-wrap">
                  {isCloudHosted ? (
                    <span className="badge badge-success flex items-center gap-1">
                      <CheckCircle2 size={13} />
                      {t('ImageKit Cloud')}
                    </span>
                  ) : (
                    <span className="badge badge-neutral flex items-center gap-1">
                      <ImageIcon size={13} />
                      {uploading ? t('Uploading...') : t('Image attached')}
                    </span>
                  )}

                  {isCloudHosted && (
                    <a
                      href={previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="imagekit-view-link"
                      title={t('View original full-size image')}
                    >
                      <ExternalLink size={13} />
                      <span>{t('Full size')}</span>
                    </a>
                  )}
                </div>

                <div className="imagekit-meta-actions">
                  <button
                    type="button"
                    className="btn btn-sm btn-secondary"
                    onClick={() => fileInputRef.current && fileInputRef.current.click()}
                    disabled={uploading}
                  >
                    <RefreshCw size={13} />
                    <span>{t('Change')}</span>
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-danger"
                    onClick={handleRemove}
                    disabled={uploading}
                    title={t('Remove photo')}
                  >
                    <X size={13} />
                    <span>{t('Remove')}</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div
              className={`imagekit-dropzone ${isDragging ? 'is-dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current && fileInputRef.current.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  fileInputRef.current && fileInputRef.current.click();
                }
              }}
            >
              <div className="dropzone-icon-wrap">
                <UploadCloud size={32} className="dropzone-icon" />
              </div>
              <div className="dropzone-content">
                <p className="dropzone-primary-text">
                  <strong>{t('Click to upload')}</strong> {t('or drag and drop photo here')}
                </p>
                <p className="dropzone-sub-text">
                  PNG, JPG, WebP, AVIF {t('up to 10MB')}
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {error && (
        <div className="imagekit-error-msg">
          <AlertCircle size={14} />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
