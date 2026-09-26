import { useEffect, useState } from 'react';
import './index.css';
import CaseDashboard from './CaseDashboard';
import CaseIntake from './CaseIntake';
import MyCases from './MyCases';
import { API_BASE_URL } from './api';

function App() {
  const [backendStatus, setBackendStatus] = useState<string>('Checking backend connection...');
  const [activeCaseId, setActiveCaseId] = useState<string | null>(() => localStorage.getItem('casecompass:lastCaseId'));
  const [view, setView] = useState<'home' | 'demo' | 'intake' | 'dashboard' | 'cases'>('home');

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/health`)
      .then((res) => res.json())
      .then((data) => setBackendStatus(data.message || 'Backend is connected!'))
      .catch(() => setBackendStatus('Backend is not running.'));
  }, []);

  if (view === 'demo' || view === 'dashboard') {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="card" style={{ margin: 0, borderRadius: 0, padding: 'var(--space-md) var(--space-lg)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div className="container flex justify-between items-center">
            <div className="flex items-center gap-sm" title={backendStatus}>
              <div style={{ width: '24px', height: '24px', backgroundColor: 'var(--color-primary)', borderRadius: '4px' }}></div>
              <h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.25rem' }}>CaseCompass</h2>
            </div>
          </div>
        </header>
        <main style={{ flex: 1 }}>
          <CaseDashboard caseId={view === 'dashboard' ? activeCaseId : undefined} onBack={() => setView('home')} />
        </main>
      </div>
    );
  }

  if (view === 'intake') {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="card" style={{ margin: 0, borderRadius: 0, padding: 'var(--space-md) var(--space-lg)', position: 'sticky', top: 0, zIndex: 10 }}>
          <div className="container flex justify-between items-center">
            <div className="flex items-center gap-sm">
              <div style={{ width: '24px', height: '24px', backgroundColor: 'var(--color-primary)', borderRadius: '4px' }}></div>
              <h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.25rem' }}>CaseCompass</h2>
            </div>
          </div>
        </header>
        <main style={{ flex: 1, paddingTop: 'var(--space-xl)' }}>
          <CaseIntake
            onBack={() => setView('home')}
            onCaseCreated={(id) => {
              setActiveCaseId(id);
              localStorage.setItem('casecompass:lastCaseId', id);
              setView('dashboard');
            }}
          />
        </main>
      </div>
    );
  }

  if (view === 'cases') {
    return (
      <div className="flex flex-col min-h-screen">
        <header className="card" style={{ margin: 0, borderRadius: 0, padding: 'var(--space-md) var(--space-lg)' }}>
          <div className="container"><h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.25rem' }}>CaseCompass</h2></div>
        </header>
        <MyCases onBack={() => setView('home')} onOpen={(id) => { setActiveCaseId(id); localStorage.setItem('casecompass:lastCaseId', id); setView('dashboard'); }} />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="card" style={{ margin: 0, borderRadius: 0, padding: 'var(--space-md) var(--space-lg)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div className="container flex justify-between items-center">
          <div className="flex items-center gap-sm">
            <div style={{ width: '24px', height: '24px', backgroundColor: 'var(--color-primary)', borderRadius: '4px' }}></div>
            <h2 style={{ margin: 0, color: 'var(--color-primary)', fontSize: '1.25rem' }}>CaseCompass</h2>
          </div>
          <nav className="flex gap-md">
            <button className="btn btn-secondary" onClick={() => setView('cases')}>My Cases</button>
            <button className="btn btn-secondary" onClick={() => setView('demo')}>Explore Demo</button>
            <button className="btn btn-primary" onClick={() => setView('intake')}>Start a Case</button>
          </nav>
        </div>
      </header>

      {/* Main Content (Landing Page) */}
      <main className="container flex-col items-center justify-center flex" style={{ flex: 1, padding: 'var(--space-xxl) var(--space-md)', textAlign: 'center' }}>

        <h1 style={{ fontSize: '3rem', marginBottom: 'var(--space-md)', maxWidth: '800px' }}>
          Your legal documents shouldn't be a mystery.
        </h1>

        <p style={{ fontSize: '1.25rem', color: 'var(--color-text-light)', maxWidth: '600px', marginBottom: 'var(--space-xl)' }}>
          CaseCompass turns scattered legal documents, facts and evidence into a structured case file—helping you understand what you have, identify what may be missing, and prepare for a conversation with a legal professional.
        </p>

        <div className="flex gap-md mb-xl" style={{ marginBottom: 'var(--space-md)' }}>
          <button className="btn btn-primary" style={{ fontSize: '1.1rem', padding: 'var(--space-md) var(--space-xl)' }} onClick={() => setView('intake')}>
            Start a Case
          </button>
          <button className="btn btn-secondary" style={{ fontSize: '1.1rem', padding: 'var(--space-md) var(--space-xl)' }} onClick={() => setView('demo')}>
            Explore Demo
          </button>
        </div>

        {/* Visual Workflow representation */}
        <div className="card flex items-center justify-center gap-md" style={{ width: '100%', maxWidth: '800px', padding: 'var(--space-xl)' }}>
          <div className="flex flex-col items-center">
            <span style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>📝</span>
            <span style={{ fontWeight: 500, color: 'var(--color-primary)' }}>Story</span>
          </div>
          <span className="text-muted">→</span>
          <div className="flex flex-col items-center">
            <span style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>📄</span>
            <span style={{ fontWeight: 500, color: 'var(--color-primary)' }}>Documents</span>
          </div>
          <span className="text-muted">→</span>
          <div className="flex flex-col items-center">
            <span style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>⏱️</span>
            <span style={{ fontWeight: 500, color: 'var(--color-primary)' }}>Timeline</span>
          </div>
          <span className="text-muted">→</span>
          <div className="flex flex-col items-center">
            <span style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>🔍</span>
            <span style={{ fontWeight: 500, color: 'var(--color-primary)' }}>Evidence</span>
          </div>
          <span className="text-muted">→</span>
          <div className="flex flex-col items-center">
            <span style={{ fontSize: '1.5rem', marginBottom: 'var(--space-sm)' }}>❓</span>
            <span style={{ fontWeight: 500, color: 'var(--color-primary)' }}>Questions</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer style={{ padding: 'var(--space-lg)', textAlign: 'center', backgroundColor: 'var(--color-surface)', marginTop: 'auto' }}>
        <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0, maxWidth: '800px', marginInline: 'auto' }}>
          <strong>Disclaimer:</strong> CaseCompass provides informational and preparation assistance. It does not provide legal advice or replace a qualified legal professional.
        </p>
      </footer>
    </div>
  );
}

export default App;
