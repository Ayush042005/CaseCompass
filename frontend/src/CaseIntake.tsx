import { useState } from 'react';
import { API_BASE_URL } from './api';

export default function CaseIntake({ onCaseCreated, onBack }: { onCaseCreated: (caseId: string) => void, onBack: () => void }) {
  const [step, setStep] = useState(1);
  
  const [description, setDescription] = useState('');
  const [parties, setParties] = useState('');
  const [approxDate, setApproxDate] = useState('');
  const [objective, setObjective] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE_URL}/api/cases`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          description, 
          parties_involved: parties,
          approximate_date: approxDate,
          objective,
          title: "Untitled Case" // Will be set intelligently later
        }),
      });
      const data = await res.json();
      onCaseCreated(data.id);
    } catch (err) {
      console.error(err);
      alert('Failed to create case.');
    } finally {
      setLoading(false);
    }
  };

  const nextStep = (e: React.MouseEvent) => {
    e.preventDefault();
    setStep(prev => prev + 1);
  }

  const prevStep = (e: React.MouseEvent) => {
    e.preventDefault();
    setStep(prev => prev - 1);
  }

  return (
    <div className="container" style={{ padding: 'var(--space-lg)', maxWidth: '600px', margin: '0 auto' }}>
      <button className="btn btn-secondary mb-xl" onClick={onBack} style={{ marginBottom: 'var(--space-md)' }}>← Back to Home</button>
      
      <div className="card" style={{ padding: 'var(--space-xl)' }}>
        <div className="flex justify-between items-center mb-lg">
          <h1 style={{ margin: 0 }}>Start a New Case</h1>
          <span className="text-muted" style={{ fontSize: '0.9rem' }}>Step {step} of 4</span>
        </div>
        
        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          {step === 1 && (
            <div className="flex flex-col gap-sm animate-fade-in">
              <label htmlFor="description" style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--color-primary)' }}>
                1. What happened?
              </label>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>
                Briefly describe your legal situation in plain language.
              </p>
              <textarea 
                id="description" 
                required 
                rows={5}
                value={description} 
                onChange={e => setDescription(e.target.value)} 
                placeholder="e.g. My previous employer hasn't paid my final salary..."
                style={{ padding: '1rem', fontSize: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #ccc', fontFamily: 'inherit', resize: 'vertical' }}
              />
              <div className="flex justify-end mt-md">
                <button className="btn btn-primary" onClick={nextStep} disabled={!description.trim()}>Next</button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-sm animate-fade-in">
              <label htmlFor="parties" style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--color-primary)' }}>
                2. Who is involved?
              </label>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>
                Names of the other parties, companies, or individuals.
              </p>
              <input 
                id="parties" 
                type="text"
                value={parties} 
                onChange={e => setParties(e.target.value)} 
                placeholder="e.g. Acme Corp (Employer)"
                style={{ padding: '1rem', fontSize: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #ccc' }}
              />
              <div className="flex justify-between mt-md">
                <button className="btn btn-secondary" onClick={prevStep}>Back</button>
                <button className="btn btn-primary" onClick={nextStep}>Next</button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-sm animate-fade-in">
              <label htmlFor="approxDate" style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--color-primary)' }}>
                3. When did this happen?
              </label>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>
                An approximate date or timeframe.
              </p>
              <input 
                id="approxDate" 
                type="text"
                value={approxDate} 
                onChange={e => setApproxDate(e.target.value)} 
                placeholder="e.g. Last month, or October 2026"
                style={{ padding: '1rem', fontSize: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #ccc' }}
              />
              <div className="flex justify-between mt-md">
                <button className="btn btn-secondary" onClick={prevStep}>Back</button>
                <button className="btn btn-primary" onClick={nextStep}>Next</button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-sm animate-fade-in">
              <label htmlFor="objective" style={{ fontSize: '1.2rem', fontWeight: 500, color: 'var(--color-primary)' }}>
                4. What do you want to understand or prepare for?
              </label>
              <p className="text-muted" style={{ fontSize: '0.9rem', marginBottom: 'var(--space-sm)' }}>
                This helps CaseCompass focus its analysis.
              </p>
              <textarea 
                id="objective" 
                rows={4}
                value={objective} 
                onChange={e => setObjective(e.target.value)} 
                placeholder="e.g. I want to know if I have enough evidence to send a legal notice."
                style={{ padding: '1rem', fontSize: '1rem', borderRadius: 'var(--radius-md)', border: '1px solid #ccc', fontFamily: 'inherit', resize: 'vertical' }}
              />
              <div className="flex justify-between mt-md">
                <button className="btn btn-secondary" onClick={prevStep}>Back</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Setting up case...' : 'Go to Case Dashboard'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
