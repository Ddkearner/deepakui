
import React, { useState, useRef } from 'react';
import Header from './components/Header';
import LogViewer from './components/LogViewer';
import { ScrapeStatus, ScrapeLog, ScrapeResult } from './types';
import { bundleFramerSite } from './services/scraperService';

type TabType = 'preview' | 'code' | 'logs';

const App: React.FC = () => {
  const [url, setUrl] = useState('');
  const [status, setStatus] = useState<ScrapeStatus>(ScrapeStatus.IDLE);
  const [logs, setLogs] = useState<ScrapeLog[]>([]);
  const [result, setResult] = useState<ScrapeResult | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('logs');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handleScrape = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLogs([]);
    setResult(null);
    setActiveTab('logs');
    setStatus(ScrapeStatus.FETCHING);

    try {
      const bundled = await bundleFramerSite(url, (newStatus, log) => {
        setStatus(newStatus);
        setLogs(prev => [...prev, log]);
      });

      setResult(bundled);
      setStatus(ScrapeStatus.SUCCESS);
      setActiveTab('preview');
    } catch (err) {
      console.error(err);
      setStatus(ScrapeStatus.ERROR);
    }
  };

  const downloadHtml = () => {
    if (!result) return;
    const blob = new Blob([result.html], { type: 'text/html' });
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `${result.title.replace(/\s+/g, '_').toLowerCase() || 'website_source'}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(blobUrl);
  };

  return (
    <div className="min-h-screen bg-[#030712] selection:bg-indigo-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(79,70,229,0.1),transparent_50%)] pointer-events-none" />
      
      <div className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        <Header />

        <main className="mt-8 space-y-8">
          {/* Action Center */}
          <section className="glass rounded-3xl p-6 shadow-2xl max-w-4xl mx-auto border-white/5 bg-white/[0.02]">
            <form onSubmit={handleScrape} className="flex flex-col md:flex-row gap-3">
              <div className="relative flex-grow">
                <input
                  type="url"
                  placeholder="Paste any website URL here..."
                  className="block w-full pl-6 pr-4 py-4 bg-gray-950 border border-gray-800 rounded-2xl text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all text-lg"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  required
                  disabled={status !== ScrapeStatus.IDLE && status !== ScrapeStatus.SUCCESS && status !== ScrapeStatus.ERROR}
                />
              </div>
              <button
                type="submit"
                disabled={status !== ScrapeStatus.IDLE && status !== ScrapeStatus.SUCCESS && status !== ScrapeStatus.ERROR}
                className="px-10 py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-500 text-white font-bold rounded-2xl transition-all flex items-center justify-center gap-2 group whitespace-nowrap shadow-lg shadow-indigo-600/20"
              >
                {status === ScrapeStatus.IDLE || status === ScrapeStatus.SUCCESS || status === ScrapeStatus.ERROR ? (
                  <>
                    <span>Download Source</span>
                    <svg className="w-5 h-5 group-hover:translate-y-[-2px] transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                    </svg>
                  </>
                ) : (
                  <div className="flex items-center gap-3">
                    <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>Fetching...</span>
                  </div>
                )}
              </button>
            </form>
          </section>

          {/* Result Dashboard */}
          {(status !== ScrapeStatus.IDLE || logs.length > 0) && (
            <div className="flex flex-col lg:flex-row gap-6">
              
              {/* Workspace */}
              <div className="flex-grow w-full lg:w-3/4 glass rounded-3xl overflow-hidden flex flex-col min-h-[600px] border border-white/5 shadow-2xl bg-black/20">
                {/* Control Bar */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/[0.02]">
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setActiveTab('logs')}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${activeTab === 'logs' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                      Process
                    </button>
                    {result && (
                      <>
                        <button 
                          onClick={() => setActiveTab('preview')}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${activeTab === 'preview' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                          Preview
                        </button>
                        <button 
                          onClick={() => setActiveTab('code')}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all uppercase tracking-wider ${activeTab === 'code' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                          Code
                        </button>
                      </>
                    )}
                  </div>
                  {result && (
                    <div className="flex items-center gap-4">
                      <div className="hidden sm:flex items-center gap-2 text-[10px] text-emerald-500 font-bold uppercase tracking-widest">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                        Success: {(result.fileSize / 1024).toFixed(0)} KB
                      </div>
                      <button 
                        onClick={downloadHtml}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase px-4 py-2 rounded-lg transition-colors"
                      >
                        Get File
                      </button>
                    </div>
                  )}
                </div>

                {/* Content Viewer */}
                <div className="flex-grow relative overflow-hidden">
                  {activeTab === 'logs' && (
                    <div className="p-6 h-full">
                      <LogViewer logs={logs} />
                    </div>
                  )}

                  {activeTab === 'preview' && result && (
                    <div className="absolute inset-0 w-full h-full bg-white">
                      <iframe 
                        ref={iframeRef}
                        title="Live Preview"
                        className="w-full h-full border-none"
                        srcDoc={result.html}
                        sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                      />
                    </div>
                  )}

                  {activeTab === 'code' && result && (
                    <div className="absolute inset-0 p-6 overflow-auto font-mono text-sm bg-[#0a0a0f]">
                      <pre className="text-indigo-300/80 whitespace-pre-wrap break-all selection:bg-indigo-500/30">
                        {result.html}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Quick Info Sidebar */}
              {result && (
                <div className="w-full lg:w-1/4 space-y-4">
                  <div className="glass rounded-3xl p-6 border-white/5 bg-white/[0.01]">
                    <h3 className="text-white font-bold text-sm mb-4 uppercase tracking-widest opacity-50">File Summary</h3>
                    <div className="space-y-4">
                      <div className="p-3 bg-white/[0.03] rounded-2xl">
                        <span className="text-gray-500 text-[10px] uppercase font-bold block mb-1">Status</span>
                        <span className="text-emerald-400 font-bold text-sm">Download Ready</span>
                      </div>
                      <div className="p-3 bg-white/[0.03] rounded-2xl">
                        <span className="text-gray-500 text-[10px] uppercase font-bold block mb-1">Resources Found</span>
                        <span className="text-white font-bold text-sm">{result.assetCount} CSS Assets</span>
                      </div>
                      <div className="p-3 bg-white/[0.03] rounded-2xl">
                        <span className="text-gray-500 text-[10px] uppercase font-bold block mb-1">Total Weight</span>
                        <span className="text-white font-bold text-sm">{(result.fileSize / 1024 / 1024).toFixed(2)} MB</span>
                      </div>
                    </div>
                    <button
                      onClick={downloadHtml}
                      className="mt-6 w-full py-4 bg-white text-black hover:bg-gray-200 font-black rounded-2xl transition-all flex items-center justify-center gap-2 uppercase tracking-tighter"
                    >
                      Download Now
                    </button>
                  </div>
                  <div className="px-4 py-2 border border-white/5 rounded-2xl text-[10px] text-gray-600 text-center uppercase tracking-widest">
                    Optimized for single-file portability
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default App;
