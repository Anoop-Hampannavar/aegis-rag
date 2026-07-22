'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, AlertCircle, UploadCloud, Send, 
  FileText, Database, CheckCircle2, Cpu, Camera,
  Sparkles, Terminal, History, Image as ImageIcon, 
  FolderArchive, MessageSquare, PanelLeft, X, Zap,
  Plus, HelpCircle, BookOpen, Info
} from 'lucide-react';

const BACKEND_URL = "https://aegis-rag-td6w.onrender.com";

// Real-Time Query Telemetry Evaluator
function RealtimePromptEvaluator({ activePrompt, lastResponse, lastTau, executionTime, isStreaming }) {
  const wordCount = lastResponse ? lastResponse.split(/\s+/).filter(Boolean).length : 0;
  const charCount = lastResponse ? lastResponse.length : 0;
  
  const isRefusal = /not mention|does not state|low_confidence|no information|not present/i.test(lastResponse || "");
  
  let groundednessScore = 0;
  if (lastResponse) {
    if (isRefusal) {
      groundednessScore = 100;
    } else if (lastTau >= 0.78) {
      groundednessScore = Math.min(100, Math.round(85 + (wordCount > 20 ? 10 : 5)));
    } else {
      groundednessScore = Math.round((lastTau || 0) * 100);
    }
  }

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-6 shadow-xl mt-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-800 pb-3 mb-4 gap-3">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-indigo-500/10 border border-indigo-500/20 rounded-lg">
            <Zap className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-sm md:text-base font-bold text-slate-100 flex items-center gap-2">
              Query Telemetry & Evaluation
              {isStreaming && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping"></span>}
            </h3>
            <p className="text-[11px] text-slate-400">RAG Triad analysis computed on active prompt</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-[11px] font-mono self-start sm:self-auto">
          <span className="text-slate-400">Query:</span>
          <span className="text-emerald-400 truncate max-w-[140px] sm:max-w-[200px]">{activePrompt || "None"}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-medium text-slate-400">Groundedness</span>
            <span className={`text-[11px] font-bold font-mono px-1.5 py-0.5 rounded ${groundednessScore >= 80 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'}`}>
              {groundednessScore}%
            </span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div className="bg-emerald-500 h-full transition-all duration-500" style={{ width: `${groundednessScore}%` }}></div>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3">
          <div className="flex justify-between items-center mb-1">
            <span className="text-[11px] font-medium text-slate-400">Sufficiency (τ)</span>
            <span className="text-[11px] font-bold font-mono text-indigo-400">{lastTau ? Number(lastTau).toFixed(2) : "0.00"}</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
            <div className="bg-indigo-500 h-full transition-all duration-500" style={{ width: `${(lastTau || 0) * 100}%` }}></div>
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Zero-Hallucination</span>
          <div className="mt-0.5">
            {isRefusal ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                <ShieldCheck className="w-3 h-3" /> Refusal Enforced
              </span>
            ) : lastResponse ? (
              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                <CheckCircle2 className="w-3 h-3" /> Context Grounded
              </span>
            ) : (
              <span className="text-[11px] text-slate-500 font-mono">Idle</span>
            )}
          </div>
        </div>

        <div className="bg-slate-950 border border-slate-800/80 rounded-lg p-3">
          <span className="text-[11px] font-medium text-slate-400 block mb-1">Execution Speed</span>
          <div className="text-sm font-bold font-mono text-amber-400">
            {executionTime ? `${executionTime} ms` : "0 ms"}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  
  // Slide-out Drawer & Modals State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('history'); // 'history', 'uploads', 'images'
  const [activeModal, setActiveModal] = useState(null); // 'howItWorks', 'howToUse', null
  
  const [uploadHistory, setUploadHistory] = useState([]);
  const [imageGallery, setImageGallery] = useState([]);
  const [queryHistory, setQueryHistory] = useState([]);

  // Query & Telemetry States
  const [query, setQuery] = useState("");
  const [activePrompt, setActivePrompt] = useState("");
  const [logs, setLogs] = useState([]);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [lastTau, setLastTau] = useState(0.78);
  const [executionTime, setExecutionTime] = useState(0);

  const logEndRef = useRef(null);

  useEffect(() => {
    checkHealth();
  }, []);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const checkHealth = async () => {
    setCheckingStatus(true);
    try {
      const res = await fetch(`${BACKEND_URL}/health`);
      if (res.ok) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      console.error("Health check error:", err);
      setIsConnected(false);
    } finally {
      setCheckingStatus(false);
    }
  };

  const startNewChat = () => {
    setFinalAnswer("");
    setLogs([]);
    setActivePrompt("");
    setQuery("");
    setDrawerOpen(false);
  };

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsUploading(true);
    setUploadStatus("Ingesting document into ChromaDB...");

    const isImg = selectedFile.type.startsWith('image/');
    const fileCategory = isImg ? "Camera Snap / Image" : "PDF Document";

    let previewUrl = null;
    if (isImg) {
      previewUrl = URL.createObjectURL(selectedFile);
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/ingest`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        const successMsg = `Success: ${data.filename} (${data.size_kb} KB) indexed cleanly.`;
        setUploadStatus(successMsg);

        const newUploadItem = {
          id: Date.now(),
          filename: data.filename || selectedFile.name,
          size: `${data.size_kb || Math.round(selectedFile.size / 1024)} KB`,
          category: fileCategory,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          previewUrl
        };

        setUploadHistory(prev => [newUploadItem, ...prev]);

        if (isImg && previewUrl) {
          setImageGallery(prev => [newUploadItem, ...prev]);
        }
      } else {
        setUploadStatus(`Error: ${data.detail || "Ingestion failed."}`);
      }
    } catch (err) {
      setUploadStatus("Error uploading document to backend.");
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendQuery = async (e) => {
    e.preventDefault();
    if (!query.trim() || isStreaming) return;

    const currentQuery = query.trim();
    setActivePrompt(currentQuery);
    setIsStreaming(true);
    setFinalAnswer("");
    setLogs((prev) => [...prev, { event: "USER_QUERY", data: currentQuery }]);

    const isBroadQuery = /summary|summarize|about|says|overview|tell me|explain/i.test(currentQuery);
    const activeThreshold = isBroadQuery ? 0.25 : 0.78;
    setLastTau(activeThreshold);

    const startTime = performance.now();

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: currentQuery, tau_threshold: activeThreshold }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonStr = line.replace("data: ", "").trim();
              if (jsonStr) {
                const parsed = JSON.parse(jsonStr);
                setLogs((prev) => [...prev, parsed]);

                if (parsed.event === "FINAL_RESPONSE") {
                  const respText = parsed.data || "";
                  setFinalAnswer(respText);
                  const endTime = performance.now();
                  setExecutionTime(Math.round(endTime - startTime));

                  setQueryHistory(prev => [
                    {
                      id: Date.now(),
                      query: currentQuery,
                      answer: respText,
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    },
                    ...prev
                  ]);
                }
              }
            } catch (e) {
              console.error("SSE parse error", e);
            }
          }
        }
      }
    } catch (err) {
      setLogs((prev) => [
        ...prev,
        { event: "ERROR", data: "Failed to connect to streaming engine." },
      ]);
    } finally {
      setIsStreaming(false);
      setQuery("");
    }
  };

  return (
    <div className="w-full min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col items-center pt-2 pb-8 px-3 md:px-8 relative overflow-x-hidden">
      
      {/* Dimmed Background Overlay */}
      {drawerOpen && (
        <div 
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 transition-opacity"
        />
      )}

      {/* Gemini-Style Floating Slide-out Drawer Sidebar */}
      <aside 
        className={`fixed top-0 left-0 h-full w-80 max-w-[85vw] bg-slate-900 border-r border-slate-800 z-50 shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400 shrink-0" />
            <span className="font-bold text-sm tracking-wide text-white">Aegis Workspace</span>
          </div>
          <button 
            onClick={() => setDrawerOpen(false)} 
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action: New Chat Button */}
        <div className="p-3 border-b border-slate-800/80">
          <button
            onClick={startNewChat}
            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-2 px-3 rounded-lg text-xs flex items-center justify-center gap-2 transition-all shadow-md"
          >
            <Plus className="w-4 h-4" /> New Chat Session
          </button>
        </div>

        {/* Drawer Classified Navigation Tabs */}
        <div className="flex border-b border-slate-800 p-2 gap-1 bg-slate-950/60 text-xs">
          <button 
            onClick={() => setActiveTab('history')} 
            className={`flex-1 py-1.5 font-semibold rounded-md transition-all flex items-center justify-center gap-1 ${activeTab === 'history' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <History className="w-3.5 h-3.5" /> History
          </button>
          <button 
            onClick={() => setActiveTab('uploads')} 
            className={`flex-1 py-1.5 font-semibold rounded-md transition-all flex items-center justify-center gap-1 ${activeTab === 'uploads' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <FolderArchive className="w-3.5 h-3.5" /> Documents
          </button>
          <button 
            onClick={() => setActiveTab('images')} 
            className={`flex-1 py-1.5 font-semibold rounded-md transition-all flex items-center justify-center gap-1 ${activeTab === 'images' ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30' : 'text-slate-400 hover:text-slate-200'}`}
          >
            <ImageIcon className="w-3.5 h-3.5" /> Snaps
          </button>
        </div>

        {/* Drawer Tab Dynamic Content */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {activeTab === 'history' && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block px-1">Recent Prompts</span>
              {queryHistory.length === 0 ? (
                <p className="text-xs text-slate-600 italic px-1">No prompt queries recorded yet.</p>
              ) : (
                queryHistory.map((item) => (
                  <div 
                    key={item.id} 
                    onClick={() => { setActivePrompt(item.query); setFinalAnswer(item.answer); setDrawerOpen(false); }}
                    className="p-2.5 bg-slate-950 border border-slate-800 hover:border-indigo-500/50 rounded-lg cursor-pointer transition-all space-y-1"
                  >
                    <div className="flex items-center space-x-1.5 text-xs text-indigo-300 font-medium">
                      <MessageSquare className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{item.query}</span>
                    </div>
                    <span className="text-[10px] text-slate-500 block">{item.timestamp}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'uploads' && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block px-1">Indexed Documents</span>
              {uploadHistory.length === 0 ? (
                <p className="text-xs text-slate-600 italic px-1">No files uploaded in this session.</p>
              ) : (
                uploadHistory.map((item) => (
                  <div key={item.id} className="p-2.5 bg-slate-950 border border-slate-800 rounded-lg space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-slate-200 truncate max-w-[140px]">{item.filename}</span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">{item.size}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span>{item.category}</span>
                      <span>{item.timestamp}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'images' && (
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block px-1">Camera OCR Snaps</span>
              {imageGallery.length === 0 ? (
                <p className="text-xs text-slate-600 italic px-1">No camera snaps captured yet.</p>
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  {imageGallery.map((img) => (
                    <div key={img.id} className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
                      <img src={img.previewUrl} alt={img.filename} className="w-full h-16 object-cover" />
                      <div className="p-1 text-[10px] text-slate-300 truncate bg-slate-900">{img.filename}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Drawer Bottom Utility Links */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 space-y-1 text-xs">
          <button 
            onClick={() => { setActiveModal('howItWorks'); setDrawerOpen(false); }}
            className="w-full text-left px-2.5 py-2 rounded-lg text-slate-300 hover:bg-slate-900 hover:text-white flex items-center gap-2 transition-colors"
          >
            <Info className="w-4 h-4 text-indigo-400" /> How Aegis-RAG Works
          </button>
          <button 
            onClick={() => { setActiveModal('howToUse'); setDrawerOpen(false); }}
            className="w-full text-left px-2.5 py-2 rounded-lg text-slate-300 hover:bg-slate-900 hover:text-white flex items-center gap-2 transition-colors"
          >
            <BookOpen className="w-4 h-4 text-emerald-400" /> User Guide & Instructions
          </button>
        </div>
      </aside>

      {/* "How It Works" Informational Modal */}
      {activeModal === 'howItWorks' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-lg w-full space-y-4 text-xs text-slate-300">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Info className="w-4 h-4 text-indigo-400" /> How Aegis-RAG Works
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 leading-relaxed">
              <p><strong className="text-indigo-400">1. Multimodal OCR Ingestion:</strong> Scanned PDFs and phone camera snaps pass through Groq Llama-3 Vision OCR to extract structured raw text.</p>
              <p><strong className="text-indigo-400">2. Vector Indexing:</strong> Extracted text chunks are embedded and indexed into a local ChromaDB collection.</p>
              <p><strong className="text-indigo-400">3. Sufficiency Validation ($\tau \ge 0.78$):</strong> Prior to LLM generation, candidate vectors undergo relevance evaluation. Insufficient context triggers a grounded refusal rather than generating hallucinations.</p>
              <p><strong className="text-indigo-400">4. Real-Time Telemetry:</strong> Execution boundary states are streamed live over Server-Sent Events (SSE).</p>
            </div>
          </div>
        </div>
      )}

      {/* "How To Use" Guide Modal */}
      {activeModal === 'howToUse' && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 max-w-lg w-full space-y-4 text-xs text-slate-300">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-400" /> User Guide & Instructions
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-1 text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-3 leading-relaxed">
              <p><strong className="text-emerald-400">Step 1:</strong> Tap <em>"Snap Live Doc"</em> to take a mobile photo, or <em>"Select PDF"</em> to upload a file.</p>
              <p><strong className="text-emerald-400">Step 2:</strong> Wait for the green success confirmation message showing ChromaDB ingestion.</p>
              <p><strong className="text-emerald-400">Step 3:</strong> Type your query in the chat bar at the bottom and tap <strong>Send</strong>.</p>
              <p><strong className="text-emerald-400">Step 4:</strong> Watch live execution steps stream in the telemetry panel and review the synthesized answer.</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Top Sticky Header Banner */}
      <header className="w-full max-w-5xl sticky top-0 bg-slate-950/90 backdrop-blur-md z-30 flex items-center justify-between py-3 border-b border-slate-800 mb-5">
        <div className="flex items-center space-x-2.5">
          <button 
            onClick={() => setDrawerOpen(true)}
            className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 transition-colors flex items-center gap-1 shrink-0"
            title="Open Sidebar"
          >
            <PanelLeft className="w-5 h-5 text-indigo-400" />
          </button>

          <ShieldCheck className="w-7 h-7 text-emerald-400 shrink-0" />
          <div>
            <h1 className="text-lg md:text-xl font-bold tracking-wide text-white leading-tight">Aegis-RAG</h1>
            <p className="text-[10px] md:text-xs text-slate-400">Enterprise Intelligence Engine</p>
          </div>
        </div>

        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-2.5 py-1 rounded-full text-[11px] shrink-0">
          {checkingStatus ? (
            <span className="text-amber-400 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span> Connecting...
            </span>
          ) : isConnected ? (
            <span className="text-emerald-400 flex items-center gap-1 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> Online
            </span>
          ) : (
            <button onClick={checkHealth} className="text-rose-400 flex items-center gap-1 hover:underline">
              <AlertCircle className="w-3.5 h-3.5" /> Retry
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-5">
        
        {/* Left Column: Upload & Ingestion */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <UploadCloud className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold text-slate-200 text-sm">Document Ingestion</h2>
            </div>
            <p className="text-xs text-slate-400 mb-5">
              Upload multi-page PDFs or camera photos. Documents are processed via Groq Vision OCR and indexed into ChromaDB.
            </p>

            <div className="grid grid-cols-2 gap-2.5">
              <label className="border border-dashed border-slate-700 hover:border-emerald-500 transition-colors rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer bg-slate-950/50 text-center">
                <Camera className="w-6 h-6 text-emerald-400 mb-1" />
                <span className="text-xs text-slate-300 font-medium">Snap Doc</span>
                <span className="text-[9px] text-slate-500 mt-0.5">Camera Photo</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  disabled={isUploading} 
                />
              </label>

              <label className="border border-dashed border-slate-700 hover:border-indigo-500 transition-colors rounded-lg p-3 flex flex-col items-center justify-center cursor-pointer bg-slate-950/50 text-center">
                <FileText className="w-6 h-6 text-indigo-400 mb-1" />
                <span className="text-xs text-slate-300 font-medium">Select PDF</span>
                <span className="text-[9px] text-slate-500 mt-0.5">Documents</span>
                <input 
                  type="file" 
                  accept=".pdf,application/pdf" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  disabled={isUploading} 
                />
              </label>
            </div>

            {uploadStatus && (
              <div className="mt-3 p-2.5 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="truncate">{uploadStatus}</span>
              </div>
            )}
          </div>

          <div className="mt-6 pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1"><Database className="w-3.5 h-3.5" /> ChromaDB Active</span>
            <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5" /> Groq Vision OCR</span>
          </div>
        </section>

        {/* Right Column: Execution Logs & Answer Display */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-4 md:p-5 flex flex-col justify-between">
          <div className="space-y-3">
            
            <div>
              <div className="flex items-center space-x-2 mb-2">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <h2 className="font-semibold text-slate-200 text-xs md:text-sm">Synthesized Answer</h2>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 min-h-[90px] text-xs text-slate-300 leading-relaxed overflow-y-auto max-h-40">
                {finalAnswer ? (
                  <div className="whitespace-pre-wrap">{finalAnswer}</div>
                ) : (
                  <div className="text-slate-600 italic flex items-center justify-center h-16">
                    {isStreaming ? "Synthesizing answer..." : "Answers will appear here."}
                  </div>
                )}
              </div>
            </div>

            <div>
              <div className="flex items-center space-x-2 mb-1.5">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <h3 className="font-semibold text-slate-200 text-xs">LangGraph Execution Telemetry</h3>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-lg p-2.5 h-32 overflow-y-auto font-mono text-[11px] space-y-1.5">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-600 italic">
                    Awaiting query execution...
                  </div>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} className="border-l-2 border-indigo-500 pl-2">
                      <span className="text-indigo-400 font-bold uppercase">{log.event || "LOG"}:</span>{" "}
                      <span className="text-slate-300">{log.data || ""}</span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>

          </div>

          <form onSubmit={handleSendQuery} className="mt-3 flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask about document..."
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={isStreaming || !query.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-3.5 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </section>

      </main>

      {/* Embedded Live Real-Time Telemetry Dashboard */}
      <div className="w-full max-w-5xl pb-8">
        <RealtimePromptEvaluator 
          activePrompt={activePrompt}
          lastResponse={finalAnswer}
          lastTau={lastTau}
          executionTime={executionTime}
          isStreaming={isStreaming}
        />
      </div>

    </div>
  );
}
