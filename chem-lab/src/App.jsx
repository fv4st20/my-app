import { useState } from 'react';
import axios from 'axios';
import { Search, Atom, BookOpen, FlaskConical, Beaker } from 'lucide-react';
import PeriodicTable from './PeriodicTable';
import Reactions from './Reactions';
import Reference from './Reference';
import './index.css';

function App() {
  const [searchQuery, setSearchQuery] = useState('');
  const [compoundData, setCompoundData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState('3d'); // '2d' or '3d'

  const [activeTab, setActiveTab] = useState('explorer');

  const searchCompound = async (query) => {
    const q = typeof query === 'string' ? query : searchQuery;
    if (!q) return;
    
    if (typeof query === 'string') setSearchQuery(q);
    
    setLoading(true);
    setError('');
    setCompoundData(null);

    try {
      // Fetch compound details from PubChem
      const res = await axios.get(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(q)}/property/MolecularFormula,MolecularWeight,IUPACName,IsomericSMILES/JSON`);
      
      if (res.data?.PropertyTable?.Properties?.length > 0) {
        const props = res.data.PropertyTable.Properties[0];
        
        // Fetch a small description/synonym or just use what we have
        // For visual, we can also use their PNG endpoint
        const imageUrl = `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/cid/${props.CID}/PNG?record_type=3d&image_size=large`;
        const iframeUrl = `https://pubchem.ncbi.nlm.nih.gov/vw3d/vw3d.cgi?cid=${props.CID}`;
        
        setCompoundData({
          ...props,
          imageUrl,
          iframeUrl
        });
      }
    } catch (err) {
      console.error(err);
      setError('Compound not found or error communicating with PubChem API.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <nav className="sidebar">
        <div className="logo">
          <FlaskConical size={32} color="#ec4899" />
          <h2>Chem Lab</h2>
        </div>
        <ul className="nav-links">
          <li className={activeTab === 'explorer' ? 'active' : ''} onClick={() => setActiveTab('explorer')}><Search size={20} /> Explorer</li>
          <li className={activeTab === 'elements' ? 'active' : ''} onClick={() => setActiveTab('elements')}><Atom size={20} /> Elements</li>
          <li className={activeTab === 'reactions' ? 'active' : ''} onClick={() => setActiveTab('reactions')}><Beaker size={20} /> Reactions</li>
          <li className={activeTab === 'reference' ? 'active' : ''} onClick={() => setActiveTab('reference')}><BookOpen size={20} /> Reference</li>
        </ul>
        <div style={{ marginTop: 'auto', paddingTop: '20px', borderTop: '1px solid var(--border-color)' }}>
          <a href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', textDecoration: 'none', padding: '10px' }}>
            <span style={{ fontSize: '1.2rem' }}>←</span> Return to Hub
          </a>
        </div>
      </nav>

      <main className="main-content">
        {activeTab === 'explorer' && (
          <>
            <header className="header">
              <h1>Educational Compound Explorer</h1>
              <p>Search for molecules using the public PubChem database.</p>
            </header>

            <section className="search-section">
              <form onSubmit={(e) => { e.preventDefault(); searchCompound(searchQuery); }} className="search-bar">
                <Search className="search-icon" size={20} />
                <input 
                  type="text" 
                  placeholder="Enter compound name (e.g., Water, Aspirin, Caffeine)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" disabled={loading}>
                  {loading ? 'Searching...' : 'Search'}
                </button>
              </form>

              <div className="quick-categories">
                <button className="pill-btn bg-red" onClick={() => searchCompound('Trinitrotoluene')}>TNT</button>
                <button className="pill-btn bg-purple" onClick={() => searchCompound('Cyanide')}>Cyanide</button>
                <button className="pill-btn bg-blue" onClick={() => searchCompound('Caffeine')}>Caffeine</button>
                <button className="pill-btn bg-green" onClick={() => searchCompound('Penicillin')}>Penicillin</button>
                <button className="pill-btn bg-yellow" onClick={() => searchCompound('Glucose')}>Glucose</button>
                <button className="pill-btn bg-gray" onClick={() => searchCompound('Sodium Chloride')}>Salt</button>
              </div>
            </section>

            {error && <div className="error-message">{error}</div>}

            {compoundData && (
              <section className="results-section">
                <div className="compound-card">
                  <div className="compound-visuals">
                    <div className="view-toggles">
                      <button className={viewMode === '2d' ? 'active' : ''} onClick={() => setViewMode('2d')}>2D Image</button>
                      <button className={viewMode === '3d' ? 'active' : ''} onClick={() => setViewMode('3d')}>3D Interactive</button>
                    </div>
                    <div className="visual-container">
                      {viewMode === '3d' ? (
                        <iframe src={compoundData.iframeUrl} title="3D Viewer" className="molecule-iframe" frameBorder="0"></iframe>
                      ) : (
                        <img src={compoundData.imageUrl} alt={compoundData.IUPACName || 'Molecule'} onError={(e) => e.target.style.display = 'none'} />
                      )}
                    </div>
                  </div>
                  <div className="compound-details">
                    <h2>{searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1)}</h2>
                    <div className="detail-item">
                      <span className="label">IUPAC Name:</span>
                      <span className="value">{compoundData.IUPACName || 'N/A'}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Formula:</span>
                      <span className="value formula">{compoundData.MolecularFormula}</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">Molecular Weight:</span>
                      <span className="value">{compoundData.MolecularWeight} g/mol</span>
                    </div>
                    <div className="detail-item">
                      <span className="label">SMILES:</span>
                      <span className="value smiles">{compoundData.IsomericSMILES}</span>
                    </div>
                  </div>
                </div>
              </section>
            )}
          </>
        )}

        {activeTab === 'elements' && (
          <PeriodicTable />
        )}

        {activeTab === 'reactions' && (
          <Reactions />
        )}

        {activeTab === 'reference' && (
          <Reference />
        )}
      </main>
    </div>
  );
}

export default App;
