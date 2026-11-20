import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { Search, Atom, BookOpen, FlaskConical, Beaker, AlertTriangle, ExternalLink } from 'lucide-react';
import PeriodicTable from './PeriodicTable';
import Reactions from './Reactions';
import Reference from './Reference';
import './index.css';

const TABS = [
  { id: 'explorer', label: 'Explorer', Icon: Search },
  { id: 'elements', label: 'Elements', Icon: Atom },
  { id: 'reactions', label: 'Reactions', Icon: Beaker },
  { id: 'reference', label: 'Reference', Icon: BookOpen }
];

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [compoundData, setCompoundData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('2d'); // '2d' or '3d'
  const [failedImageKey, setFailedImageKey] = useState(null);
  const [activeTab, setActiveTab] = useState('explorer');
  const abortControllerRef = useRef(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, []);

  const searchCompound = async (query) => {
    const raw = typeof query === 'string' ? query : searchQuery;
    const q = raw.trim();
    if (!q) return;

    if (typeof query === 'string') {
      setSearchQuery(q);
    }

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError('');
    setCompoundData(null);
    setFailedImageKey(null);

    try {
      const res = await axios.get(
        `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(q)}/property/MolecularFormula,MolecularWeight,IUPACName,IsomericSMILES,CanonicalSMILES/JSON`,
        { signal: controller.signal, timeout: 8000 }
      );

      const props = res.data?.PropertyTable?.Properties?.[0];
      const cid = Number(props?.CID);

      if (props && Number.isInteger(cid) && cid > 0) {
        const image2dUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${cid}/PNG?image_size=large`;
        const iframeUrl = `https://pubchem.ncbi.nlm.nih.gov/vw3d/vw3d.cgi?cid=${cid}`;
        const pubchemUrl = `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}`;

        setCompoundData({
          ...props,
          CID: cid,
          displayName: q.charAt(0).toUpperCase() + q.slice(1),
          smiles: props.IsomericSMILES || props.CanonicalSMILES || props.ConnectivitySMILES || props.SMILES || 'N/A',
          image2dUrl,
          iframeUrl,
          pubchemUrl
        });
      } else {
        setError('No compound data returned for that query.');
      }
    } catch (err) {
      if (axios.isCancel(err) || err?.name === 'AbortError' || err?.code === 'ERR_CANCELED') {
        return;
      }
      setError('Compound not found or error communicating with the PubChem database.');
    } finally {
      if (abortControllerRef.current === controller) {
        setLoading(false);
      }
    }
  };

  const currentImgKey = compoundData ? `${compoundData.CID}-2d` : null;

  return (
    <div className="app-container">
      <nav className="sidebar" aria-label="Chem Lab Navigation">
        <div className="logo">
          <FlaskConical size={32} color="#ec4899" />
          <h2>Chem Lab</h2>
        </div>
        <ul className="nav-links" role="tablist">
          {TABS.map(({ id, label, Icon }) => (
            <li
              key={id}
              role="tab"
              tabIndex={0}
              aria-selected={activeTab === id}
              className={activeTab === id ? 'active' : ''}
              onClick={() => setActiveTab(id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setActiveTab(id);
                }
              }}
            >
              <Icon size={20} /> {label}
            </li>
          ))}
        </ul>
        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
          <a
            href="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              color: 'var(--text-muted)',
              textDecoration: 'none',
              padding: '10px'
            }}
          >
            <span style={{ fontSize: '1.2rem' }}>←</span> Return to Hub
          </a>
        </div>
      </nav>

      <main className="main-content">
        {/* Educational & Laboratory Safety Disclaimer Banner */}
        <div
          className="safety-banner"
          role="note"
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: '12px',
            background: 'rgba(245, 158, 11, 0.12)',
            border: '1px solid rgba(245, 158, 11, 0.4)',
            borderRadius: '12px',
            padding: '12px 16px',
            marginBottom: '28px',
            color: '#fde68a',
            fontSize: '0.9rem',
            lineHeight: 1.5
          }}
        >
          <AlertTriangle size={20} color="#fbbf24" style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <strong>Educational Simulation Disclaimer:</strong> Chem Lab is strictly for educational visualization. Never
            attempt real chemical reactions or mix household or laboratory substances without qualified laboratory
            supervision, proper ventilation, and certified personal protective equipment (PPE).
          </div>
        </div>

        {activeTab === 'explorer' && (
          <>
            <header className="header">
              <h1>Educational Compound Explorer</h1>
              <p>Search molecular formulas, structures, and properties via the public PubChem database.</p>
            </header>

            <section className="search-section">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  searchCompound(searchQuery);
                }}
                className="search-bar"
              >
                <Search className="search-icon" size={20} />
                <input
                  type="text"
                  aria-label="Compound name"
                  placeholder="Enter compound name (e.g., Water, Aspirin, Caffeine)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" disabled={loading || !searchQuery.trim()}>
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </form>

              <div className="quick-categories">
                <button type="button" className="pill-btn bg-blue" onClick={() => searchCompound('Caffeine')}>
                  Caffeine
                </button>
                <button type="button" className="pill-btn bg-green" onClick={() => searchCompound('Aspirin')}>
                  Aspirin
                </button>
                <button type="button" className="pill-btn bg-yellow" onClick={() => searchCompound('Glucose')}>
                  Glucose
                </button>
                <button type="button" className="pill-btn bg-purple" onClick={() => searchCompound('Penicillin G')}>
                  Penicillin G
                </button>
                <button type="button" className="pill-btn bg-gray" onClick={() => searchCompound('Sodium Chloride')}>
                  Sodium Chloride
                </button>
                <button type="button" className="pill-btn bg-red" onClick={() => searchCompound('Ethanol')}>
                  Ethanol
                </button>
              </div>
            </section>

            {error && (
              <div className="error-message" role="alert">
                {error}
              </div>
            )}

            {compoundData && (
              <section className="results-section">
                <div className="compound-card">
                  <div className="compound-visuals">
                    <div className="view-toggles">
                      <button
                        type="button"
                        className={viewMode === '2d' ? 'active' : ''}
                        onClick={() => setViewMode('2d')}
                      >
                        2D Structure
                      </button>
                      <button
                        type="button"
                        className={viewMode === '3d' ? 'active' : ''}
                        onClick={() => setViewMode('3d')}
                      >
                        3D Interactive
                      </button>
                    </div>
                    <div className="visual-container">
                      {viewMode === '3d' ? (
                        <iframe
                          src={compoundData.iframeUrl}
                          title={`3D Viewer for ${compoundData.displayName}`}
                          className="molecule-iframe"
                          sandbox="allow-scripts allow-same-origin"
                          referrerPolicy="no-referrer"
                          loading="lazy"
                        />
                      ) : failedImageKey === currentImgKey ? (
                        <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '16px' }}>
                          Structure preview unavailable for CID {compoundData.CID}.
                        </div>
                      ) : (
                        <img
                          src={compoundData.image2dUrl}
                          alt={compoundData.IUPACName || compoundData.displayName}
                          referrerPolicy="no-referrer"
                          onError={() => setFailedImageKey(currentImgKey)}
                        />
                      )}
                    </div>
                    <a
                      href={compoundData.pubchemUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        marginTop: '10px',
                        fontSize: '0.8rem',
                        color: 'var(--text-muted)',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px',
                        textDecoration: 'none'
                      }}
                    >
                      View PubChem CID #{compoundData.CID} <ExternalLink size={13} />
                    </a>
                  </div>
                  <div className="compound-details">
                    <h2>{compoundData.displayName}</h2>
                    <div className="detail-item">
                      <span className="label">IUPAC Name:</span>
                      <span className="value">{compoundData.IUPACName || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Formula:</span>
                      <span className="value formula">{compoundData.MolecularFormula || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Molecular Weight:</span>
                      <span className="value">
                        {compoundData.MolecularWeight ? `${compoundData.MolecularWeight} g/mol` : 'N/A'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="label">SMILES:</span>
                      <span className="value smiles">{compoundData.smiles}</span>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === 'elements' && <PeriodicTable />}
        {activeTab === 'reactions' && <Reactions />}
        {activeTab === 'reference' && <Reference />}
      </main>
    </div>
  );
}

export default App;
