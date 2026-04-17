import React, { useState } from 'react';
import { universes as universesApi } from '../api/universes';

const s = {
  wrap: {
    minHeight: '100vh', background: '#04000a',
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    padding: '40px 24px',
  },
  title: {
    fontFamily: 'monospace', fontSize: 28, fontWeight: 700,
    color: '#e2d9f3', marginBottom: 8, letterSpacing: 2,
  },
  subtitle: {
    fontFamily: 'monospace', fontSize: 13, color: '#6b7280', marginBottom: 40,
  },
  textarea: {
    width: '100%', maxWidth: 640, minHeight: 180,
    background: 'rgba(168,85,247,0.06)',
    border: '1px solid rgba(168,85,247,0.3)',
    borderRadius: 8, padding: '16px', resize: 'vertical',
    fontFamily: 'monospace', fontSize: 15, color: '#e2d9f3',
    outline: 'none', lineHeight: 1.6,
  },
  btn: {
    marginTop: 16, padding: '10px 32px',
    background: '#a855f7', color: '#04000a',
    border: 'none', borderRadius: 6,
    fontFamily: 'monospace', fontWeight: 700, fontSize: 14,
    cursor: 'pointer',
  },
  progress: {
    fontFamily: 'monospace', fontSize: 13, color: '#a855f7',
    marginTop: 16, minHeight: 20,
  },
  error: {
    fontFamily: 'monospace', fontSize: 13, color: '#f87171',
    marginTop: 16, maxWidth: 640, textAlign: 'center',
  },
  examples: {
    marginTop: 32, maxWidth: 640, width: '100%',
  },
  exLabel: {
    fontFamily: 'monospace', fontSize: 11, color: '#4b5563', marginBottom: 8,
  },
  exBtn: {
    display: 'inline-block', marginRight: 8, marginBottom: 8,
    padding: '4px 10px', background: 'rgba(168,85,247,0.1)',
    border: '1px solid rgba(168,85,247,0.2)', borderRadius: 4,
    fontFamily: 'monospace', fontSize: 11, color: '#9ca3af', cursor: 'pointer',
  },
};

const EXAMPLES = [
  'A 1920s noir detective agency with three detectives of contrasting styles and an informant',
  'A space colony financial system with traders, economists, and a regulator agent managing scarce resources',
  'A scientific lab where biologists, chemists, and a data analyst collaborate to discover new compounds',
  'A medieval kingdom with a king, advisors, a spymaster, and a court jester who often reveals uncomfortable truths',
];

const STEPS = ['Parsing universe...', 'Designing agents...', 'Seeding events...', 'Starting session...'];

export default function CreateUniverse({ onCreated }) {
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('');
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!description.trim()) return;
    setLoading(true);
    setError('');

    // Animate steps while waiting
    let i = 0;
    const interval = setInterval(() => {
      setStep(STEPS[i % STEPS.length]);
      i++;
    }, 1800);

    try {
      const data = await universesApi.create({ description });
      clearInterval(interval);
      onCreated(data);
    } catch (err) {
      clearInterval(interval);
      setError(err.message);
    } finally {
      setLoading(false);
      setStep('');
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.title}>AGENTIC UNIVERSE</div>
      <div style={s.subtitle}>Describe your universe in plain language</div>

      <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 640, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <textarea
          style={s.textarea}
          placeholder="A noir detective agency in 1920s Chicago, where three detectives with contrasting methods compete and collaborate to solve cases..."
          value={description}
          onChange={e => setDescription(e.target.value)}
          disabled={loading}
        />
        <button style={s.btn} type="submit" disabled={loading || !description.trim()}>
          {loading ? 'Creating...' : 'Create Universe'}
        </button>
      </form>

      {step && <div style={s.progress}>{step}</div>}
      {error && <div style={s.error}>{error}</div>}

      <div style={s.examples}>
        <div style={s.exLabel}>Examples:</div>
        {EXAMPLES.map((ex, i) => (
          <span key={i} style={s.exBtn} onClick={() => setDescription(ex)}>{ex.slice(0, 50)}…</span>
        ))}
      </div>
    </div>
  );
}
