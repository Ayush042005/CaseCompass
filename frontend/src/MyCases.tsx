import { useEffect, useState } from 'react';
import { API_BASE_URL } from './api';

type SavedCase = {
  id: string;
  title: string;
  description: string;
  status: string;
  documents: { id: string }[];
  facts?: unknown[];
};

export default function MyCases({ onBack, onOpen }: { onBack: () => void; onOpen: (id: string) => void }) {
  const [cases, setCases] = useState<SavedCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/cases`)
      .then((res) => {
        if (!res.ok) throw new Error('Failed to load cases');
        return res.json();
      })
      .then(setCases)
      .catch(() => setError('Unable to load saved cases. Make sure the backend is running.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="container" style={{ padding: 'var(--space-xl) var(--space-md)', maxWidth: '900px' }}>
      <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 'var(--space-md)' }}>← Back to Home</button>
      <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-lg)' }}>
        <div>
          <h1 style={{ marginBottom: 'var(--space-xs)' }}>My Cases</h1>
          <p className="text-muted" style={{ margin: 0 }}>Open a saved case and continue organizing its evidence.</p>
        </div>
      </div>

      {loading && <div className="card"><p className="text-muted" style={{ margin: 0 }}>Loading saved cases...</p></div>}
      {error && <div className="card" style={{ borderLeft: '4px solid #b91c1c' }}><p style={{ color: '#b91c1c', margin: 0 }}>{error}</p></div>}
      {!loading && !error && cases.length === 0 && (
        <div className="card" style={{ textAlign: 'center', padding: 'var(--space-xxl)' }}>
          <h2>No saved cases yet</h2>
          <p className="text-muted">Start a case to create your first case file.</p>
          <button className="btn btn-primary" onClick={onBack}>Go to Home</button>
        </div>
      )}
      {!loading && !error && cases.length > 0 && (
        <div className="flex flex-col gap-md">
          {cases.map((item) => (
            <article className="card" key={item.id} style={{ marginBottom: 0 }}>
              <div className="flex justify-between items-center" style={{ gap: 'var(--space-md)' }}>
                <div style={{ minWidth: 0 }}>
                  <h2 style={{ fontSize: '1.2rem', marginBottom: 'var(--space-xs)' }}>{item.title}</h2>
                  <p style={{ color: 'var(--color-text-light)', marginBottom: 'var(--space-sm)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.description}</p>
                  <span className="text-muted" style={{ fontSize: '0.85rem' }}>{item.documents.length} documents · {item.facts?.length ?? 0} facts · {item.status}</span>
                </div>
                <button className="btn btn-primary" onClick={() => onOpen(item.id)}>Open Case</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
