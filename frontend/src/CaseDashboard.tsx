import { useCallback, useEffect, useState } from 'react';
import { API_BASE_URL } from './api';

type FactItem = {
  fact: string;
  evidence: string;
  confidence: string;
  source_passage?: string;
};

type ClauseItem = {
  category: string;
  plain_language: string;
  original_text: string;
  source: string;
  attention_note: string;
};

type MissingInfoItem = {
  item: string;
  reason: string;
  suggestion: string;
} | string; // backwards compat with old string format

type TimelineItem = {
  date: string;
  event: string;
  evidence: string;
  status?: string;
};

type DocumentItem = {
  id: string;
  name: string;
  type: string;
  size?: number;
};

type CaseData = {
  id: string;
  title: string;
  description: string;
  parties_involved?: string;
  approximate_date?: string;
  objective?: string;
  status: string;
  facts?: FactItem[];
  clauses?: ClauseItem[];
  timeline: TimelineItem[];
  documents: DocumentItem[];
  missing_info: MissingInfoItem[];
};

type TabKey = 'overview' | 'timeline' | 'documents' | 'evidence' | 'clauses' | 'missing' | 'ask' | 'prepare';

const TABS: { key: TabKey; label: string; icon: string }[] = [
  { key: 'overview', label: 'Overview', icon: '📊' },
  { key: 'timeline', label: 'Timeline', icon: '⏱️' },
  { key: 'documents', label: 'Documents', icon: '📄' },
  { key: 'evidence', label: 'Evidence Map', icon: '🔗' },
  { key: 'clauses', label: 'Clauses', icon: '📋' },
  { key: 'missing', label: 'Missing Info', icon: '❓' },
];

TABS.push(
  { key: 'ask', label: 'Ask This Case', icon: '?' },
  { key: 'prepare', label: 'Prepare', icon: 'P' },
);

/* ---------- small helpers ---------- */

function confidenceBadge(confidence: string) {
  const map: Record<string, { label: string; color: string; bg: string }> = {
    document_supported: { label: '✓ Supported', color: '#166534', bg: '#dcfce7' },
    high: { label: '✓ Supported', color: '#166534', bg: '#dcfce7' },
    user_reported: { label: '⚑ User reported', color: '#92400e', bg: '#fef3c7' },
    medium: { label: '⚑ User reported', color: '#92400e', bg: '#fef3c7' },
    needs_confirmation: { label: '? Needs confirmation', color: '#9a3412', bg: '#fee2e2' },
    low: { label: '? Needs confirmation', color: '#9a3412', bg: '#fee2e2' },
  };
  const style = map[confidence] ?? { label: confidence, color: '#5A5A5A', bg: '#E7ECEF' };
  return (
    <span style={{
      display: 'inline-block',
      fontSize: '0.75rem',
      fontWeight: 600,
      padding: '0.15rem 0.5rem',
      borderRadius: '1rem',
      color: style.color,
      backgroundColor: style.bg,
      whiteSpace: 'nowrap',
    }}>
      {style.label}
    </span>
  );
}

function formatFileSize(bytes?: number) {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMissingItemFields(item: MissingInfoItem) {
  if (typeof item === 'string') return { item: item, reason: '', suggestion: '' };
  return item;
}

/* ---------- component ---------- */

export default function CaseDashboard({ caseId, onBack }: { caseId?: string | null; onBack: () => void }) {
  const [caseData, setCaseData] = useState<CaseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reanalyzing, setReanalyzing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [expandedFact, setExpandedFact] = useState<number | null>(null);
  const [expandedClause, setExpandedClause] = useState<number | null>(null);
  const [question, setQuestion] = useState('');
  const [answer, setAnswer] = useState<{ answer: string; sources: string[]; limitation: string } | null>(null);
  const [asking, setAsking] = useState(false);
  const [lawyerQuestions, setLawyerQuestions] = useState<string[]>([]);
  const [brief, setBrief] = useState('');
  const [preparing, setPreparing] = useState(false);
  const [prepareError, setPrepareError] = useState('');

  const fetchCase = useCallback(() => {
    const endpoint = caseId ? `${API_BASE_URL}/api/cases/${caseId}` : `${API_BASE_URL}/api/demo`;
    fetch(endpoint)
      .then(res => res.json())
      .then(data => {
        setCaseData(data);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [caseId]);

  useEffect(() => {
    fetchCase();
  }, [fetchCase]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || !caseId) return;

    setUploading(true);
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/cases/${caseId}/documents`, {
        method: 'POST',
        body: formData,
      });
      if (res.ok) {
        fetchCase();
      } else {
        alert('Failed to upload document');
      }
    } catch (err) {
      console.error(err);
      alert('Error uploading document');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const retryDocumentAnalysis = async () => {
    if (!caseId) return;
    setReanalyzing(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cases/${caseId}/reanalyze-documents`, { method: 'POST' });
      if (!res.ok) throw new Error('Re-analysis failed');
      setCaseData(await res.json());
    } catch { alert('Unable to re-analyze the documents right now.'); }
    finally { setReanalyzing(false); }
  };

  const askQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseId || !question.trim()) return;
    setAsking(true); setAnswer(null);
    try {
      const res = await fetch(`${API_BASE_URL}/api/cases/${caseId}/ask`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question }),
      });
      if (!res.ok) throw new Error('Question failed');
      setAnswer(await res.json());
    } catch {
      setAnswer({ answer: 'Unable to answer this question right now. Please try again.', sources: [], limitation: 'The case assistant is unavailable.' });
    } finally { setAsking(false); }
  };

  const loadPreparation = async (kind: 'questions' | 'brief') => {
    if (!caseId) return;
    setPreparing(true); setPrepareError('');
    try {
      const endpoint = kind === 'questions' ? 'lawyer-questions' : 'generate-brief';
      const res = await fetch(`${API_BASE_URL}/api/cases/${caseId}/${endpoint}`, { method: 'POST' });
      if (!res.ok) throw new Error('Preparation failed');
      const data = await res.json();
      if (kind === 'questions') setLawyerQuestions(data.questions ?? []);
      else setBrief(data.brief ?? '');
    } catch { setPrepareError('Unable to generate preparation material right now. Please try again.'); }
    finally { setPreparing(false); }
  };

  const downloadBrief = () => {
    if (!brief) return;
    const blob = new Blob([brief], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url; link.download = `${caseData?.title || 'case'}-brief.md`; link.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="container" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-md)' }}>⏳</div>
        <p style={{ color: 'var(--color-text-light)', fontSize: '1.1rem' }}>Loading case data...</p>
      </div>
    );
  }

  if (!caseData || 'error' in caseData) {
    return (
      <div className="container" style={{ padding: '4rem 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 'var(--space-md)' }}>⚠️</div>
        <p>Error loading case data. Make sure the backend is running.</p>
        <button className="btn btn-secondary" onClick={onBack} style={{ marginTop: 'var(--space-md)' }}>Go Back</button>
      </div>
    );
  }

  const facts = caseData.facts ?? [];
  const clauses = caseData.clauses ?? [];
  const supportedFacts = facts.filter(f => f.confidence === 'document_supported' || f.confidence === 'high');
  const unresolvedFacts = facts.filter(f => f.confidence === 'needs_confirmation' || f.confidence === 'low');

  /* ---------- Tab styling ---------- */
  const tabStyle = (tab: TabKey): React.CSSProperties => ({
    padding: '0.65rem 1rem',
    cursor: 'pointer',
    borderBottom: activeTab === tab ? '2px solid var(--color-primary)' : '2px solid transparent',
    color: activeTab === tab ? 'var(--color-primary)' : 'var(--color-text-light)',
    fontWeight: activeTab === tab ? 600 : 400,
    background: 'transparent',
    borderTop: 'none',
    borderLeft: 'none',
    borderRight: 'none',
    fontSize: '0.92rem',
    whiteSpace: 'nowrap',
    transition: 'color 0.15s ease, border-color 0.15s ease',
  });

  /* ================================================================
   * RENDER
   * ================================================================ */
  return (
    <div className="container" style={{ padding: 'var(--space-lg) var(--space-md)' }}>
      <button className="btn btn-secondary" onClick={onBack} style={{ marginBottom: 'var(--space-md)' }}>← Back to Home</button>

      {/* ---- Case Header ---- */}
      <div className="card" style={{ padding: 'var(--space-lg)', marginBottom: 'var(--space-md)' }}>
        <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-sm)' }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>{caseData.title}</h1>
          <span style={{
            backgroundColor: 'var(--color-background)',
            color: 'var(--color-primary)',
            padding: '0.25rem 0.75rem',
            borderRadius: '1rem',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}>
            {caseData.status}
          </span>
        </div>
        <p style={{ color: 'var(--color-text-main)', fontSize: '1rem', marginBottom: 'var(--space-md)', lineHeight: 1.6 }}>
          {caseData.description}
        </p>
        <div className="flex gap-lg" style={{ fontSize: '0.88rem', color: 'var(--color-text-light)', flexWrap: 'wrap' }}>
          {caseData.parties_involved && <div><strong>Parties:</strong> {caseData.parties_involved}</div>}
          {caseData.approximate_date && <div><strong>Date:</strong> {caseData.approximate_date}</div>}
          {caseData.objective && <div><strong>Objective:</strong> {caseData.objective}</div>}
        </div>
      </div>

      {/* ---- Quick Stats ---- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 'var(--space-sm)', marginBottom: 'var(--space-md)' }}>
        {[
          { label: 'Documents', value: caseData.documents.length, icon: '📄' },
          { label: 'Facts', value: facts.length, icon: '✓' },
          { label: 'Timeline', value: caseData.timeline.length, icon: '⏱️' },
          { label: 'Clauses', value: clauses.length, icon: '📋' },
          { label: 'Missing', value: caseData.missing_info.length, icon: '❓' },
        ].map(stat => (
          <div key={stat.label} className="card" style={{ padding: 'var(--space-md)', textAlign: 'center', marginBottom: 0 }}>
            <div style={{ fontSize: '1.25rem' }}>{stat.icon}</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{stat.value}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)' }}>{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ---- Tab Bar ---- */}
      <div className="flex gap-sm" style={{ borderBottom: '1px solid var(--color-background)', marginBottom: 'var(--space-md)', overflowX: 'auto' }}>
        {TABS.map(t => (
          <button key={t.key} style={tabStyle(t.key)} onClick={() => setActiveTab(t.key)}>
            <span style={{ marginRight: '0.35rem' }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      {/* ---- Tab Content ---- */}
      <div style={{ minHeight: '400px' }}>

        {/* ====================== OVERVIEW ====================== */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            {/* What We Know */}
            <div className="card" style={{ padding: 'var(--space-md)', borderLeft: '4px solid #16a34a' }}>
              <h3 style={{ margin: '0 0 var(--space-sm) 0', color: 'var(--color-primary)' }}>What We Know</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: 'var(--space-sm)' }}>
                Facts supported by uploaded material
              </p>
              {supportedFacts.length === 0 ? (
                <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>
                  No verified facts yet. Upload documents to begin analysis.
                </p>
              ) : (
                <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                  {supportedFacts.slice(0, 6).map((f, i) => (
                    <li key={i} style={{ marginBottom: '0.5rem', fontSize: '0.92rem' }}>
                      {f.fact}
                      <div style={{ marginTop: '0.2rem' }}>{confidenceBadge(f.confidence)}</div>
                    </li>
                  ))}
                  {supportedFacts.length > 6 && (
                    <li style={{ color: 'var(--color-secondary)', cursor: 'pointer', listStyle: 'none', marginLeft: '-1.25rem' }}
                        onClick={() => setActiveTab('evidence')}>
                      + {supportedFacts.length - 6} more → View Evidence Map
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* What We Have */}
            <div className="card" style={{ padding: 'var(--space-md)', borderLeft: '4px solid var(--color-secondary)' }}>
              <h3 style={{ margin: '0 0 var(--space-sm) 0', color: 'var(--color-primary)' }}>What We Have</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: 'var(--space-sm)' }}>
                Available documents and evidence
              </p>
              {caseData.documents.length === 0 ? (
                <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>No documents uploaded.</p>
              ) : (
                <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                  {caseData.documents.map(d => (
                    <li key={d.id} style={{ marginBottom: '0.4rem', fontSize: '0.92rem' }}>
                      📄 {d.name}
                      <span style={{ color: 'var(--color-muted)', fontSize: '0.8rem', marginLeft: '0.5rem' }}>
                        {d.type}{d.size ? ` · ${formatFileSize(d.size)}` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* What's Unclear */}
            <div className="card" style={{ padding: 'var(--space-md)', borderLeft: '4px solid #f59e0b' }}>
              <h3 style={{ margin: '0 0 var(--space-sm) 0', color: 'var(--color-primary)' }}>What's Unclear</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: 'var(--space-sm)' }}>
                Missing or unverified information
              </p>
              {caseData.missing_info.length === 0 ? (
                <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>No gaps identified yet.</p>
              ) : (
                <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                  {caseData.missing_info.slice(0, 4).map((info, i) => {
                    const m = getMissingItemFields(info);
                    return (
                      <li key={i} style={{ marginBottom: '0.5rem', fontSize: '0.92rem' }}>
                        {m.item}
                        {m.reason && <div style={{ fontSize: '0.8rem', color: 'var(--color-text-light)', marginTop: '0.15rem' }}>{m.reason}</div>}
                      </li>
                    );
                  })}
                  {caseData.missing_info.length > 4 && (
                    <li style={{ color: 'var(--color-secondary)', cursor: 'pointer', listStyle: 'none', marginLeft: '-1.25rem' }}
                        onClick={() => setActiveTab('missing')}>
                      + {caseData.missing_info.length - 4} more → View Missing Info
                    </li>
                  )}
                </ul>
              )}
            </div>

            {/* Key Clauses */}
            <div className="card" style={{ padding: 'var(--space-md)', borderLeft: '4px solid var(--color-primary)' }}>
              <h3 style={{ margin: '0 0 var(--space-sm) 0', color: 'var(--color-primary)' }}>Key Clauses</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--color-text-light)', marginBottom: 'var(--space-sm)' }}>
                Important contractual provisions
              </p>
              {clauses.length === 0 ? (
                <p style={{ color: 'var(--color-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>No clauses identified yet.</p>
              ) : (
                <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                  {clauses.slice(0, 4).map((c, i) => (
                    <li key={i} style={{ marginBottom: '0.5rem', fontSize: '0.92rem' }}>
                      <span style={{
                        fontWeight: 600,
                        fontSize: '0.75rem',
                        color: 'var(--color-primary)',
                        backgroundColor: 'var(--color-background)',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '4px',
                        marginRight: '0.4rem',
                      }}>
                        {c.category}
                      </span>
                      {c.plain_language}
                    </li>
                  ))}
                  {clauses.length > 4 && (
                    <li style={{ color: 'var(--color-secondary)', cursor: 'pointer', listStyle: 'none', marginLeft: '-1.25rem' }}
                        onClick={() => setActiveTab('clauses')}>
                      + {clauses.length - 4} more → View All Clauses
                    </li>
                  )}
                </ul>
              )}
            </div>
          </div>
        )}

        {/* ====================== TIMELINE ====================== */}
        {activeTab === 'timeline' && (
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <h2 style={{ marginTop: 0, marginBottom: 'var(--space-md)' }}>Chronological Timeline</h2>
            {caseData.timeline.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>⏱️</div>
                <p className="text-muted">No timeline events detected yet. Upload documents to build a timeline.</p>
              </div>
            ) : (
              <div className="flex flex-col" style={{ gap: 0 }}>
                {caseData.timeline
                  .sort((a, b) => a.date.localeCompare(b.date))
                  .map((item, i) => (
                  <div key={i} style={{
                    display: 'grid',
                    gridTemplateColumns: '120px 20px 1fr',
                    gap: 'var(--space-md)',
                    alignItems: 'start',
                    paddingBottom: 'var(--space-md)',
                    minHeight: '60px',
                  }}>
                    {/* Date column */}
                    <div style={{ textAlign: 'right', fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-primary)', paddingTop: '2px' }}>
                      {new Date(item.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>

                    {/* Dot + Line */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{
                        width: '12px',
                        height: '12px',
                        borderRadius: '50%',
                        backgroundColor: item.status === 'document_supported' ? 'var(--color-primary)' : '#f59e0b',
                        border: '2px solid var(--color-surface)',
                        boxShadow: '0 0 0 2px ' + (item.status === 'document_supported' ? 'var(--color-primary)' : '#f59e0b'),
                        flexShrink: 0,
                        marginTop: '4px',
                      }} />
                      {i < caseData.timeline.length - 1 && (
                        <div style={{ width: '2px', backgroundColor: 'var(--color-background)', flex: 1, minHeight: '20px', marginTop: '4px' }} />
                      )}
                    </div>

                    {/* Content */}
                    <div style={{ paddingBottom: 'var(--space-sm)' }}>
                      <div style={{ fontSize: '0.95rem', marginBottom: '0.3rem' }}>{item.event}</div>
                      <div className="flex gap-sm items-center" style={{ flexWrap: 'wrap' }}>
                        <span style={{
                          backgroundColor: 'var(--color-background)',
                          color: 'var(--color-primary)',
                          padding: '0.1rem 0.4rem',
                          borderRadius: '4px',
                          fontWeight: 500,
                          fontSize: '0.78rem',
                        }}>
                          📄 {item.evidence}
                        </span>
                        {item.status && confidenceBadge(item.status)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====================== DOCUMENTS ====================== */}
        {activeTab === 'documents' && (
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-md)' }}>
              <h2 style={{ margin: 0 }}>Uploaded Documents</h2>
              <div>
                <input
                  type="file"
                  id="doc-upload"
                  style={{ display: 'none' }}
                  onChange={handleFileUpload}
                  disabled={uploading || !caseId}
                  accept=".pdf,.txt,.docx,.md"
                />
                <label
                  htmlFor="doc-upload"
                  className={`btn btn-primary ${uploading || !caseId ? 'btn-muted' : ''}`}
                  style={{ margin: 0, display: 'inline-block', cursor: uploading || !caseId ? 'not-allowed' : 'pointer' }}
                >
                  {uploading ? 'Uploading & Analyzing...' : '+ Upload Document'}
                </label>
              </div>
            </div>

            {caseId && caseData.documents.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-md)' }}>
                <button className="btn btn-secondary" onClick={retryDocumentAnalysis} disabled={reanalyzing}>
                  {reanalyzing ? 'Re-analyzing...' : 'Retry Analysis'}
                </button>
              </div>
            )}

            {!caseId && (
              <div style={{
                padding: 'var(--space-md)',
                backgroundColor: '#fef3c7',
                borderRadius: 'var(--radius-md)',
                marginBottom: 'var(--space-md)',
                fontSize: '0.88rem',
                color: '#92400e',
              }}>
                ⚠️ Document upload is available when you create a new case. This demo case uses pre-loaded data.
              </div>
            )}

            {caseData.documents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', border: '2px dashed var(--color-background)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📂</div>
                <p className="text-muted" style={{ marginBottom: 'var(--space-md)' }}>No documents have been uploaded yet.</p>
                {caseId && <label htmlFor="doc-upload" className="btn btn-secondary" style={{ cursor: 'pointer' }}>Select Files</label>}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {caseData.documents.map(doc => (
                  <div key={doc.id} style={{
                    padding: '1rem',
                    borderBottom: '1px solid var(--color-background)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}>
                    <div className="flex items-center gap-sm">
                      <span style={{ fontSize: '1.25rem' }}>📄</span>
                      <div>
                        <span style={{ fontWeight: 500 }}>{doc.name}</span>
                        {doc.size && <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)', marginLeft: '0.5rem' }}>{formatFileSize(doc.size)}</span>}
                      </div>
                    </div>
                    <span style={{
                      fontSize: '0.82rem',
                      color: 'var(--color-text-light)',
                      backgroundColor: 'var(--color-background)',
                      padding: '0.25rem 0.5rem',
                      borderRadius: '4px',
                    }}>
                      {doc.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====================== EVIDENCE MAP ====================== */}
        {activeTab === 'evidence' && (
          <div className="card" style={{ padding: 'var(--space-lg)' }}>
            <h2 style={{ marginTop: 0, marginBottom: 'var(--space-sm)' }}>Evidence Map</h2>
            <p style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', marginBottom: 'var(--space-lg)' }}>
              Every important fact linked to its supporting evidence. Click a fact to view the source passage.
            </p>

            {facts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>🔗</div>
                <p className="text-muted">No facts extracted yet. Upload documents to build the evidence map.</p>
              </div>
            ) : (
              <div style={{ overflow: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.92rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-background)' }}>
                      <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--color-primary)', fontWeight: 600, width: '45%' }}>Claim / Fact</th>
                      <th style={{ textAlign: 'left', padding: '0.75rem 0.5rem', color: 'var(--color-primary)', fontWeight: 600, width: '30%' }}>Evidence</th>
                      <th style={{ textAlign: 'center', padding: '0.75rem 0.5rem', color: 'var(--color-primary)', fontWeight: 600, width: '25%' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facts.map((f, i) => (
                      <>
                        <tr
                          key={`fact-${i}`}
                          style={{
                            borderBottom: expandedFact === i ? 'none' : '1px solid var(--color-background)',
                            cursor: f.source_passage ? 'pointer' : 'default',
                            backgroundColor: expandedFact === i ? '#f0f7ff' : 'transparent',
                            transition: 'background-color 0.15s ease',
                          }}
                          onClick={() => f.source_passage && setExpandedFact(expandedFact === i ? null : i)}
                        >
                          <td style={{ padding: '0.75rem 0.5rem', lineHeight: 1.5 }}>
                            {f.fact}
                            {f.source_passage && (
                              <span style={{ color: 'var(--color-secondary)', fontSize: '0.78rem', marginLeft: '0.4rem' }}>
                                {expandedFact === i ? '▲' : '▼'}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            <span style={{
                              backgroundColor: 'var(--color-background)',
                              padding: '0.2rem 0.5rem',
                              borderRadius: '4px',
                              fontWeight: 500,
                              fontSize: '0.85rem',
                            }}>
                              📄 {f.evidence}
                            </span>
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            {confidenceBadge(f.confidence)}
                          </td>
                        </tr>
                        {expandedFact === i && f.source_passage && (
                          <tr key={`detail-${i}`} style={{ borderBottom: '1px solid var(--color-background)' }}>
                            <td colSpan={3} style={{
                              padding: '0 0.5rem 0.75rem 0.5rem',
                              backgroundColor: '#f0f7ff',
                            }}>
                              <div style={{
                                padding: 'var(--space-md)',
                                backgroundColor: 'var(--color-surface)',
                                border: '1px solid var(--color-accent)',
                                borderRadius: 'var(--radius-sm)',
                                fontSize: '0.88rem',
                                lineHeight: 1.6,
                                fontStyle: 'italic',
                                color: 'var(--color-text-light)',
                              }}>
                                <div style={{ fontWeight: 600, fontStyle: 'normal', color: 'var(--color-primary)', marginBottom: '0.3rem', fontSize: '0.78rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                                  Source Passage
                                </div>
                                "{f.source_passage}"
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>

                {/* Evidence summary */}
                <div style={{
                  marginTop: 'var(--space-lg)',
                  padding: 'var(--space-md)',
                  backgroundColor: 'var(--color-background)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  gap: 'var(--space-lg)',
                  justifyContent: 'center',
                  fontSize: '0.88rem',
                }}>
                  <span><strong style={{ color: '#166534' }}>{supportedFacts.length}</strong> Supported</span>
                  <span><strong style={{ color: '#92400e' }}>{facts.filter(f => f.confidence === 'user_reported' || f.confidence === 'medium').length}</strong> User reported</span>
                  <span><strong style={{ color: '#9a3412' }}>{unresolvedFacts.length}</strong> Needs confirmation</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====================== CLAUSES ====================== */}
        {activeTab === 'clauses' && (
          <div>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <h2 style={{ marginTop: 0, marginBottom: 'var(--space-xs)' }}>Important Clauses</h2>
              <p style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', margin: 0 }}>
                Key contractual and legal provisions identified in your documents. Click a clause to see the original text.
              </p>
            </div>

            {clauses.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>📋</div>
                <p className="text-muted">No clauses identified yet. Upload contracts or agreements to extract important provisions.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-md">
                {clauses.map((clause, i) => (
                  <div
                    key={i}
                    className="card"
                    style={{
                      padding: 0,
                      marginBottom: 0,
                      overflow: 'hidden',
                      cursor: 'pointer',
                      border: expandedClause === i ? '1px solid var(--color-accent)' : '1px solid transparent',
                      transition: 'border-color 0.15s ease',
                    }}
                    onClick={() => setExpandedClause(expandedClause === i ? null : i)}
                  >
                    {/* Clause header */}
                    <div style={{
                      padding: 'var(--space-md)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 'var(--space-md)',
                    }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                          <span style={{
                            fontWeight: 600,
                            fontSize: '0.78rem',
                            color: 'var(--color-surface)',
                            backgroundColor: 'var(--color-primary)',
                            padding: '0.15rem 0.5rem',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                          }}>
                            {clause.category}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: 'var(--color-muted)' }}>📄 {clause.source}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.95rem', lineHeight: 1.5 }}>{clause.plain_language}</p>
                      </div>
                      <span style={{ color: 'var(--color-secondary)', fontSize: '0.85rem', flexShrink: 0, marginTop: '0.2rem' }}>
                        {expandedClause === i ? '▲' : '▼'}
                      </span>
                    </div>

                    {/* Expanded detail */}
                    {expandedClause === i && (
                      <div style={{
                        padding: '0 var(--space-md) var(--space-md) var(--space-md)',
                        borderTop: '1px solid var(--color-background)',
                      }}>
                        {/* Original text */}
                        <div style={{
                          padding: 'var(--space-md)',
                          backgroundColor: '#f9fafb',
                          border: '1px solid var(--color-background)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.88rem',
                          lineHeight: 1.6,
                          fontFamily: "'Georgia', serif",
                          fontStyle: 'italic',
                          color: 'var(--color-text-main)',
                          marginTop: 'var(--space-md)',
                          marginBottom: 'var(--space-md)',
                        }}>
                          <div style={{ fontWeight: 600, fontStyle: 'normal', fontFamily: "'Inter', sans-serif", color: 'var(--color-primary)', marginBottom: '0.3rem', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                            Original Text
                          </div>
                          "{clause.original_text}"
                        </div>

                        {/* Attention note */}
                        {clause.attention_note && (
                          <div style={{
                            padding: 'var(--space-sm) var(--space-md)',
                            backgroundColor: '#fef3c7',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.85rem',
                            color: '#92400e',
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: '0.4rem',
                          }}>
                            <span style={{ flexShrink: 0 }}>💡</span>
                            <span>{clause.attention_note}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ====================== MISSING INFO ====================== */}
        {activeTab === 'missing' && (
          <div>
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <h2 style={{ marginTop: 0, marginBottom: 'var(--space-xs)' }}>Missing Information</h2>
              <p style={{ color: 'var(--color-text-light)', fontSize: '0.9rem', margin: 0 }}>
                Gaps, missing documents, and unverified claims identified in your case.
              </p>
            </div>

            {caseData.missing_info.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-sm)' }}>✅</div>
                <p className="text-muted">No obvious gaps identified. Upload more documents for a thorough analysis.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-md">
                {caseData.missing_info.map((info, i) => {
                  const m = getMissingItemFields(info);
                  return (
                    <div key={i} className="card" style={{ padding: 'var(--space-md)', marginBottom: 0, borderLeft: '4px solid #f59e0b' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-sm)' }}>
                        <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: '2px' }}>⚠️</span>
                        <div style={{ flex: 1 }}>
                          <h4 style={{ margin: '0 0 0.3rem 0', fontSize: '1rem', color: 'var(--color-text-main)' }}>
                            {m.item}
                          </h4>
                          {m.reason && (
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.88rem', color: 'var(--color-text-light)', lineHeight: 1.5 }}>
                              {m.reason}
                            </p>
                          )}
                          {m.suggestion && (
                            <div style={{
                              padding: 'var(--space-sm) var(--space-md)',
                              backgroundColor: '#eff6ff',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.85rem',
                              color: 'var(--color-primary)',
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '0.4rem',
                            }}>
                              <span style={{ flexShrink: 0 }}>💡</span>
                              <span>{m.suggestion}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* "You may want to gather" summary */}
            {caseData.missing_info.length > 0 && (
              <div className="card" style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', backgroundColor: '#f0f7ff' }}>
                <h4 style={{ margin: '0 0 var(--space-sm) 0', color: 'var(--color-primary)' }}>📌 You may want to gather:</h4>
                <ul style={{ paddingLeft: '1.25rem', margin: 0 }}>
                  {caseData.missing_info.map((info, i) => {
                    const m = getMissingItemFields(info);
                    return <li key={i} style={{ marginBottom: '0.3rem', fontSize: '0.9rem' }}>{m.item}</li>;
                  })}
                </ul>
                <p style={{ margin: 'var(--space-md) 0 0 0', fontSize: '0.82rem', color: 'var(--color-muted)', fontStyle: 'italic' }}>
                  These suggestions are informational. Consider asking a legal professional whether these materials are necessary for your specific situation.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ask' && (
          <div className="card" style={{ padding: 'var(--space-lg)', maxWidth: '820px' }}>
            <h2 style={{ marginTop: 0 }}>Ask About This Case</h2>
            <p className="text-muted">Ask about facts, documents, dates, or open questions recorded in this case.</p>
            {!caseId ? (
              <p className="text-muted">Create a case to use case questions. The demo is read-only.</p>
            ) : (
              <>
                <form onSubmit={askQuestion} className="flex gap-sm" style={{ alignItems: 'stretch' }}>
                  <input value={question} onChange={e => setQuestion(e.target.value)} placeholder="e.g. Which facts are supported by documents?" style={{ flex: 1, padding: '0.8rem', border: '1px solid #ccc', borderRadius: 'var(--radius-sm)', font: 'inherit' }} />
                  <button className="btn btn-primary" disabled={asking || !question.trim()}>{asking ? 'Thinking...' : 'Ask'}</button>
                </form>
                {answer && <div style={{ marginTop: 'var(--space-lg)', padding: 'var(--space-md)', background: '#f0f7ff', borderRadius: 'var(--radius-sm)' }}>
                  <p style={{ whiteSpace: 'pre-wrap', marginBottom: 'var(--space-sm)' }}>{answer.answer}</p>
                  {answer.sources.length > 0 && <p style={{ fontSize: '0.85rem', marginBottom: 'var(--space-sm)' }}><strong>Sources:</strong> {answer.sources.join(', ')}</p>}
                  <p className="text-muted" style={{ fontSize: '0.82rem', margin: 0 }}>{answer.limitation}</p>
                </div>}
              </>
            )}
          </div>
        )}

        {activeTab === 'prepare' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="card" style={{ padding: 'var(--space-lg)' }}>
              <h2 style={{ marginTop: 0 }}>Questions for a Legal Professional</h2>
              <p className="text-muted">Generate practical questions based on the current case file.</p>
              <button className="btn btn-primary" onClick={() => loadPreparation('questions')} disabled={preparing || !caseId}>{preparing ? 'Generating...' : 'Generate Questions'}</button>
              {lawyerQuestions.length > 0 && <ol style={{ paddingLeft: '1.25rem', marginTop: 'var(--space-lg)' }}>{lawyerQuestions.map((item, i) => <li key={i} style={{ marginBottom: '0.65rem' }}>{item}</li>)}</ol>}
            </div>
            <div className="card" style={{ padding: 'var(--space-lg)' }}>
              <h2 style={{ marginTop: 0 }}>Case Brief</h2>
              <p className="text-muted">Create a readable Markdown summary of the current case.</p>
              <div className="flex gap-sm">
                <button className="btn btn-primary" onClick={() => loadPreparation('brief')} disabled={preparing || !caseId}>{preparing ? 'Generating...' : 'Generate Brief'}</button>
                {brief && <button className="btn btn-secondary" onClick={downloadBrief}>Download .md</button>}
              </div>
              {brief && <pre style={{ whiteSpace: 'pre-wrap', marginTop: 'var(--space-lg)', padding: 'var(--space-md)', background: '#f7f8f9', borderRadius: 'var(--radius-sm)', maxHeight: '520px', overflow: 'auto', fontFamily: 'inherit', fontSize: '0.88rem' }}>{brief}</pre>}
            </div>
            {prepareError && <p style={{ color: '#b91c1c', gridColumn: '1 / -1' }}>{prepareError}</p>}
          </div>
        )}

      </div>
    </div>
  );
}
