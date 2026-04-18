import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_URL = process.env.REACT_APP_API_URL || '';

function App() {
  // Steps: 1=upload, 2=compose, 3=sending, 4=doneeee
  const [step, setStep] = useState(1);
  const [contacts, setContacts] = useState([]);
  const [duplicatesRemoved, setDuplicatesRemoved] = useState(0);
  const [fileName, setFileName] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [gmailConfigured, setGmailConfigured] = useState(null);
  const [campaigns, setCampaigns] = useState(() => {
    try {
      const saved = localStorage.getItem('gobar_campaigns');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [selectedCampaign, setSelectedCampaign] = useState(null);

  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const pollRef = useRef(null);

  // Check health on mount
  useEffect(() => {
    axios.get(`${API_URL}/api/health`)
      .then(res => setGmailConfigured(res.data.gmail_configured))
      .catch(() => setGmailConfigured(false));
  }, []);

  // Poll job status
  const pollJobStatus = useCallback(() => {
    if (!jobId) return;
    pollRef.current = setInterval(async () => {
      try {
        const res = await axios.get(`${API_URL}/api/job/${jobId}`);
        setJobStatus(res.data);
        if (res.data.status === 'completed' || res.data.status === 'cancelled') {
          clearInterval(pollRef.current);
          setStep(4);
        }
      } catch (err) {
        console.error('Error polling:', err);
      }
    }, 2000);
  }, [jobId]);

  useEffect(() => {
    if (jobId && step === 3) {
      pollJobStatus();
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobId, step, pollJobStatus]);

  // Handle Excel upload
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setError('');
    setLoading(true);
    setFileName(file.name);

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_URL}/api/parse-excel`, formData);
      setContacts(res.data.contacts);
      setDuplicatesRemoved(res.data.duplicates_removed);
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al procesar el archivo');
      setFileName('');
    } finally {
      setLoading(false);
    }
  };

  // Handle image selection
  const handleImageSelect = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
  };

  // Send emails
  const handleSend = async () => {
    if (!subject.trim()) { setError('Escribí un asunto'); return; }
    if (!body.trim()) { setError('Escribí el contenido después del saludo'); return; }

    setError('');
    setLoading(true);

    const fullBody = `Hola {{nombre}}, ${body}`;

    const formData = new FormData();
    formData.append('subject', subject);
    formData.append('body', fullBody);
    formData.append('contacts', JSON.stringify(contacts));
    if (image) formData.append('image', image);

    try {
      const res = await axios.post(`${API_URL}/api/send`, formData);
      setJobId(res.data.job_id);
      setJobStatus({ status: 'queued', total: res.data.total, sent: 0, failed: 0, progress: 0 });
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || 'Error al iniciar el envío');
    } finally {
      setLoading(false);
    }
  };

  // Cancel job
  const handleCancel = async () => {
    if (!jobId) return;
    try {
      await axios.post(`${API_URL}/api/job/${jobId}/cancel`);
    } catch (err) {
      console.error('Error cancelling:', err);
    }
  };

  // Save campaign to history
  const saveCampaign = () => {
    if (!jobStatus) return;
    const campaign = {
      id: jobId,
      date: new Date().toISOString(),
      subject,
      sent: jobStatus.sent,
      failed: jobStatus.failed,
      total: jobStatus.total,
      log: jobStatus.log || [],
      status: jobStatus.status,
    };
    const updated = [campaign, ...campaigns];
    setCampaigns(updated);
    localStorage.setItem('gobar_campaigns', JSON.stringify(updated));
  };

  // Reset
  const handleReset = () => {
    if (step === 4 && jobStatus) {
      saveCampaign();
    }
    setStep(1);
    setContacts([]);
    setFileName('');
    setSubject('');
    setBody('');
    setImage(null);
    setImagePreview(null);
    setJobId(null);
    setJobStatus(null);
    setError('');
    setDuplicatesRemoved(0);
    setSelectedCampaign(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  // Download all emails (success + errors) as CSV
  const downloadSentEmails = () => {
    if (!jobStatus?.log || jobStatus.log.length === 0) return;

    const allEmails = jobStatus.log;

    // Header with Status and Error columns
    const csvLines = ['Email,Nombre,Estado,Observaciones'];

    // Add all emails (successful and failed)
    allEmails.forEach(e => {
      const estado = e.status === 'ok' ? 'Enviado' : 'Error';
      const observaciones = e.error || '';
      const line = `"${e.email}","${e.name || ''}","${estado}","${observaciones}"`;
      csvLines.push(line);
    });

    const csv = csvLines.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `correos-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const SentEmailsList = () => {
    const allEmails = jobStatus?.log || [];
    const successEmails = allEmails.filter(entry => entry.status === 'ok');

    return (
      <div className="sent-emails-card">
        <div className="sent-emails-header">
          <h3>Correos ({allEmails.length})</h3>
          {successEmails.length > 0 && (
            <button className="btn-download" onClick={downloadSentEmails}>
              📥 Descargar CSV
            </button>
          )}
        </div>

        <div className="sent-emails-list">
          {allEmails.length > 0 ? (
            allEmails.map((entry, i) => (
              <div key={i} className={`sent-email-item ${entry.status === 'ok' ? 'success' : 'error'}`}>
                <span className="email-icon">{entry.status === 'ok' ? '✓' : '✗'}</span>
                <div className="email-content">
                  <div className="email-address">{entry.email}</div>
                  {entry.name && <div className="email-name">{entry.name}</div>}
                  {entry.error && <div className="email-error">{entry.error}</div>}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-state">Sin correos</div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="app">
      <header className="header">
        <h1 className="logo">
          <span className="logo-icon">📧</span> GoBar
          <span className="logo-sub">Email Masivo</span>
        </h1>
        {gmailConfigured === false && (
          <div className="warning-banner">
            Gmail no está configurado. Revisá las variables de entorno.
          </div>
        )}
      </header>

      <main className="layout">
        {/* Progress Steps */}
        <div className="steps-bar">
          {['Cargar Lista', 'Componer Email', 'Enviando', 'Resultado'].map((label, i) => (
            <div key={i} className={`step-item ${step > i ? 'completed' : ''} ${step === i + 1 ? 'active' : ''}`}>
              <div className="step-number">{step > i + 1 ? '✓' : i + 1}</div>
              <span className="step-label">{label}</span>
            </div>
          ))}
        </div>

        <div className="content-area">
          <div className="main-flow">
          {error && <div className="error-msg">{error}<button onClick={() => setError('')}>✕</button></div>}

        {/* STEP 1: Upload */}
        {step === 1 && (
          <div className="card">
            <h2>Cargar lista de contactos</h2>
            <p className="card-desc">Subí un archivo Excel (.xlsx) o CSV con una columna "Email"</p>

            <div
              className="upload-zone"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                const file = e.dataTransfer.files[0];
                if (file) {
                  const dt = new DataTransfer();
                  dt.items.add(file);
                  fileInputRef.current.files = dt.files;
                  handleFileUpload({ target: { files: [file] } });
                }
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleFileUpload}
                hidden
              />
              {loading ? (
                <div className="upload-loading">
                  <div className="spinner"></div>
                  <p>Procesando {fileName}...</p>
                </div>
              ) : (
                <>
                  <div className="upload-icon">📁</div>
                  <p className="upload-text">Arrastrá tu archivo acá o hacé click para seleccionar</p>
                  <p className="upload-hint">.xlsx, .xls, .csv</p>
                </>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Compose */}
        {step === 2 && (
          <div className="card">
            <div className="contacts-summary">
              <span className="contacts-count">{contacts.length}</span> contactos cargados
              {duplicatesRemoved > 0 && <span className="duplicates">({duplicatesRemoved} duplicados removidos)</span>}
              <button className="btn-link" onClick={handleReset}>Cambiar archivo</button>
            </div>

            <div className="form-group">
              <label>Asunto del correo</label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Ej: Novedades de GoBar - Abril 2026"
                className="input"
              />
            </div>

            <div className="form-group">
              <label>Cuerpo del correo</label>
              <div className="email-body-container">
                <div className="email-greeting">{"Hola {{nombre}}, "}</div>
                <textarea
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="te escribimos para contarte..."
                  className="textarea"
                  rows={8}
                />
              </div>
              <p className="field-hint">El saludo personalizado se agregará automáticamente al inicio de cada correo</p>
            </div>

            <div className="form-group">
              <label>Imagen (opcional)</label>
              <div className="image-upload-row">
                <button className="btn-secondary" onClick={() => imageInputRef.current?.click()}>
                  {image ? '📷 Cambiar imagen' : '📷 Seleccionar imagen'}
                </button>
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  hidden
                />
                {image && <span className="image-name">{image.name}</span>}
              </div>
              {imagePreview && (
                <div className="image-preview">
                  <img src={imagePreview} alt="Preview" />
                  <button className="btn-remove" onClick={() => { setImage(null); setImagePreview(null); }}>✕</button>
                </div>
              )}
            </div>

            <div className="actions">
              <button className="btn-secondary" onClick={handleReset}>Volver</button>
              <button className="btn-primary" onClick={handleSend} disabled={loading}>
                {loading ? 'Iniciando...' : `Enviar a ${contacts.length} contactos`}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Sending */}
        {step === 3 && jobStatus && (
          <div className="card">
            <h2>Enviando correos...</h2>
            <div className="progress-container">
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${jobStatus.progress}%` }}></div>
              </div>
              <span className="progress-text">{jobStatus.progress}%</span>
            </div>

            <div className="stats-row">
              <div className="stat">
                <span className="stat-number">{jobStatus.sent}</span>
                <span className="stat-label">Enviados</span>
              </div>
              <div className="stat">
                <span className="stat-number stat-error">{jobStatus.failed}</span>
                <span className="stat-label">Fallidos</span>
              </div>
              <div className="stat">
                <span className="stat-number">{jobStatus.total}</span>
                <span className="stat-label">Total</span>
              </div>
            </div>

            {jobStatus.log && jobStatus.log.length > 0 && (
              <div className="log-section">
                <h3>Últimos envíos</h3>
                <div className="log-list">
                  {jobStatus.log.slice(-10).reverse().map((entry, i) => (
                    <div key={i} className={`log-entry ${entry.status}`}>
                      <span className="log-status">{entry.status === 'ok' ? '✓' : '✗'}</span>
                      <span className="log-email">{entry.email}</span>
                      {entry.name && <span className="log-name">({entry.name})</span>}
                      {entry.error && <span className="log-error">{entry.error}</span>}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="actions">
              <button className="btn-danger" onClick={handleCancel}>Cancelar envío</button>
            </div>
          </div>
        )}

        {/* STEP 4: Done */}
        {step === 4 && jobStatus && (
          <div className="card">
            <div className="done-header">
              <span className="done-icon">{jobStatus.status === 'completed' ? '✅' : '⚠️'}</span>
              <h2>{jobStatus.status === 'completed' ? 'Envío completado' : 'Envío cancelado'}</h2>
            </div>

            <div className="stats-row">
              <div className="stat">
                <span className="stat-number stat-success">{jobStatus.sent}</span>
                <span className="stat-label">Enviados exitosamente</span>
              </div>
              <div className="stat">
                <span className="stat-number stat-error">{jobStatus.failed}</span>
                <span className="stat-label">Fallidos</span>
              </div>
            </div>

            {jobStatus.failed > 0 && jobStatus.log && (
              <div className="log-section">
                <h3>Correos fallidos</h3>
                <div className="log-list">
                  {jobStatus.log.filter(e => e.status === 'error').map((entry, i) => (
                    <div key={i} className="log-entry error">
                      <span className="log-status">✗</span>
                      <span className="log-email">{entry.email}</span>
                      <span className="log-error">{entry.error}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="actions">
              <button className="btn-primary" onClick={handleReset}>Nueva campaña</button>
            </div>
          </div>
        )}
          </div>

          <aside className="sidebar">
            <SentEmailsList />
          </aside>
        </div>
      </main>

      <footer className="footer">
        <p>GoBar Email Masivo — Límite Gmail: ~500 correos/día</p>
      </footer>
    </div>
  );
}

export default App;
