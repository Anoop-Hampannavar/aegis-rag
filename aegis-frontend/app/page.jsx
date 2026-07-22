'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, AlertCircle, UploadCloud, Send, 
  FileText, Activity, Database, CheckCircle2, Cpu, Camera,
  Sparkles, Terminal, FileCheck, Layers
} from 'lucide-react';

const BACKEND_URL = "https://aegis-rag-td6w.onrender.com";

export default function Home() {
  const [isConnected, setIsConnected] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [file, setFile] = useState(null);
  const [uploadStatus, setUploadStatus] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [query, setQuery] = useState("");
  const [logs, setLogs] = useState([]);
  const [finalAnswer, setFinalAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const logEndRef = useRef(null);

  // Check backend health on mount
  useEffect(() => {
    checkHealth();
  }, []);

  // Auto-scroll streaming log window
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

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsUploading(true);
    setUploadStatus("Ingesting document into ChromaDB...");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/ingest`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setUploadStatus(`Success: ${data.filename} (${data.size_kb} KB) indexed cleanly.`);
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

    setIsStreaming(true);
    setFinalAnswer("");
    setLogs((prev) => [...prev, { event: "USER_QUERY", data: query }]);

    // Dynamic threshold routing
    const isBroadQuery = /summary|summarize|about|says|overview|tell me|explain/i.test(query);
    const activeThreshold = isBroadQuery ? 0.25 : 0.78;

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, tau_threshold: activeThreshold }),
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
                  setFinalAnswer(parsed.data);
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

  const getEventBadge = (event) => {
    switch (event) {
      case 'STATE_INIT':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">INIT</span>;
      case 'VECTOR_SEARCH':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">SEARCH</span>;
      case 'SUFFICIENCY_CHECK':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">CHECK</span>;
      case 'CONTRADICTION_FILTER':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">VERIFY</span>;
      case 'FINAL_RESPONSE':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">RESPONSE</span>;
      case 'USER_QUERY':
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-700 text-slate-200">PROMPT</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-slate-800 text-slate-400">LOG</span>;
    }
  };

  return (
    <div className="relative min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col items-center p-4 md:p-8 selection:bg-indigo-500 selection:text-white overflow-hidden">
      
      {/* Background Ambience: Subtle Radial Ambient Light Glows */}
      <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none -z-10 animate-pulse"></div>
      <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-indigo-500/10 rounded-full blur-[140px] pointer-events-none -z-10"></div>

      {/* Grid Pattern Background Overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b15_1px,transparent_1px),linear-gradient(to_bottom,#1e293b15_1px,transparent_1px)] bg-[size:32px_32px] pointer-events-none -z-10"></div>

      {/* Header Banner */}
      <header className="w-full max-w-6xl flex flex-col sm:flex-row items-center justify-between py-5 border-b border-slate-800/80 mb-8 gap-4 backdrop-blur-md bg-slate-950/40 rounded-2xl px-6 border">
        <div className="flex items-center space-x-3.5">
          <div className="p-2.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <ShieldCheck className="w-8 h-8 text-emerald-400" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white">
              Aegis<span className="text-emerald-400">-RAG</span>
            </h1>
            <p className="text-sm text-slate-400 font-medium">Enterprise Self-Correcting Intelligence Engine</p>
          </div>
        </div>

        {/* Live Backend Connection Status */}
        <div className="flex items-center space-x-2.5 bg-slate-900/90 border border-slate-800 px-4 py-2 rounded-full text-xs md:text-sm font-medium shadow-inner">
          {checkingStatus ? (
            <span className="text-amber-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping"></span> Connecting Server...
            </span>
          ) : isConnected ? (
            <span className="text-emerald-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399]"></span> System Online
            </span>
          ) : (
            <button onClick={checkHealth} className="text-rose-400 flex items-center gap-2 hover:underline">
              <AlertCircle className="w-4 h-4" /> Retry Connection
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Document Ingestion Controls */}
        <section className="lg:col-span-5 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-2xl backdrop-blur-xl relative overflow-hidden group">
          
          {/* Subtle Corner Card Accent Overlay */}
          <div className="absolute -top-24 -left-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div>
            <div className="flex items-center space-x-2.5 mb-3">
              <UploadCloud className="w-6 h-6 text-indigo-400" />
              <h2 className="text-lg font-semibold text-slate-100">Document Ingestion</h2>
            </div>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed">
              Upload multi-page PDFs, resumes, or camera photos. Aegis extracts raw text via Vision OCR and indexes it into ChromaDB automatically.
            </p>

            {/* Ingestion Cards */}
            <div className="grid grid-cols-1 gap-4">
              
              {/* Option A: Direct Mobile Camera Snap */}
              <label className="group relative border border-slate-700/60 hover:border-emerald-500/80 bg-slate-950/80 hover:bg-emerald-950/20 transition-all rounded-xl p-5 flex items-center space-x-4 cursor-pointer shadow-lg">
                <div className="p-3 bg-emerald-500/10 rounded-lg text-emerald-400 group-hover:scale-105 transition-transform border border-emerald-500/20">
                  <Camera className="w-7 h-7" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-200 group-hover:text-emerald-300">Snap Live Document</span>
                  <span className="text-xs text-slate-400 mt-0.5">Capture textbook cover or page via Phone Camera</span>
                </div>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  disabled={isUploading} 
                />
              </label>

              {/* Option B: System Files & PDF Selector */}
              <label className="group relative border border-slate-700/60 hover:border-indigo-500/80 bg-slate-950/80 hover:bg-indigo-950/20 transition-all rounded-xl p-5 flex items-center space-x-4 cursor-pointer shadow-lg">
                <div className="p-3 bg-indigo-500/10 rounded-lg text-indigo-400 group-hover:scale-105 transition-transform border border-indigo-500/20">
                  <FileText className="w-7 h-7" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-slate-200 group-hover:text-indigo-300">Select PDF / Document</span>
                  <span className="text-xs text-slate-400 mt-0.5">Upload multi-page PDFs, Drive files, or Downloads</span>
                </div>
                <input 
                  type="file" 
                  accept=".pdf,application/pdf" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  disabled={isUploading} 
                />
              </label>

            </div>

            {/* Upload Status Alert */}
            {uploadStatus && (
              <div className="mt-5 p-4 bg-slate-950/90 border border-slate-800 rounded-xl text-sm text-slate-200 flex items-start gap-3 shadow-inner">
                <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span className="leading-snug">{uploadStatus}</span>
              </div>
            )}
          </div>

          <div className="mt-8 pt-5 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 font-medium">
            <span className="flex items-center gap-1.5"><Database className="w-4 h-4 text-slate-500" /> ChromaDB Active</span>
            <span className="flex items-center gap-1.5"><Cpu className="w-4 h-4 text-slate-500" /> Groq Vision OCR</span>
          </div>
        </section>

        {/* Right Column: Execution Logs & Answer Display */}
        <section className="lg:col-span-7 bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between shadow-2xl backdrop-blur-xl relative overflow-hidden gap-6">
          
          {/* Subtle Corner Card Accent Overlay */}
          <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="space-y-6">
            
            {/* Answer Display Panel */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <Sparkles className="w-5 h-5 text-indigo-400" />
                  <h2 className="text-lg font-semibold text-slate-100">Synthesized Answer</h2>
                </div>
                {isStreaming && (
                  <span className="text-xs text-indigo-400 flex items-center gap-1.5 animate-pulse font-medium">
                    <span className="w-2 h-2 rounded-full bg-indigo-400"></span> Generating response...
                  </span>
                )}
              </div>

              <div className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-5 min-h-[140px] text-sm text-slate-200 leading-relaxed shadow-inner backdrop-blur-md">
                {finalAnswer ? (
                  <div className="prose prose-invert max-w-none text-slate-200 font-sans whitespace-pre-wrap leading-relaxed">
                    {finalAnswer}
                  </div>
                ) : (
                  <div className="h-full min-h-[100px] flex items-center justify-center text-slate-500 text-sm italic">
                    {isStreaming ? "Synthesizing answer from verified document context..." : "Ask a question below to analyze the active document."}
                  </div>
                )}
              </div>
            </div>

            {/* LangGraph Pipeline Execution Logs */}
            <div>
              <div className="flex items-center space-x-2 mb-3">
                <Terminal className="w-5 h-5 text-emerald-400" />
                <h3 className="text-sm font-semibold text-slate-200">LangGraph Execution Telemetry</h3>
              </div>

              <div className="bg-slate-950/90 border border-slate-800/90 rounded-xl p-4 h-52 overflow-y-auto font-mono text-xs space-y-3 shadow-inner backdrop-blur-md">
                {logs.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-600 italic">
                    Awaiting query execution...
                  </div>
                ) : (
                  logs.map((log, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 border-b border-slate-900 pb-2 last:border-0 last:pb-0">
                      <div className="shrink-0 mt-0.5">{getEventBadge(log.event)}</div>
                      <span className="text-slate-300 leading-normal break-words">{log.data}</span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>

          </div>

          {/* Query Form Input */}
          <form onSubmit={handleSendQuery} className="flex gap-2.5 pt-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask anything about the document (e.g. 'Summarize education details')..."
              className="flex-1 bg-slate-950/90 border border-slate-800/90 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={isStreaming || !query.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-5 py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-lg shrink-0"
            >
              <Send className="w-4 h-4" />
              <span>Send</span>
            </button>
          </form>

        </section>

      </main>
    </div>
  );
}
