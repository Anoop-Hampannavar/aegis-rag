'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, AlertCircle, UploadCloud, Send, 
  FileText, Activity, Database, CheckCircle2, Cpu, Camera, Sparkles
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
        setUploadStatus(`Success: ${data.filename || selectedFile.name} indexed cleanly.`);
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
    setLogs((prev) => [...prev, { event: "USER_QUERY", data: query }]);

    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/query`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, tau_threshold: 0.78 }),
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
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans flex flex-col items-center p-3 md:p-8 selection:bg-indigo-500 selection:text-white">
      
      {/* Glow Ambient Backdrop Lights */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-500/10 blur-[120px] pointer-events-none rounded-full"></div>
      <div className="fixed bottom-0 right-0 w-80 h-80 bg-emerald-500/10 blur-[120px] pointer-events-none rounded-full"></div>

      {/* Header Banner */}
      <header className="w-full max-w-5xl flex items-center justify-between py-3 px-4 border border-slate-800/80 bg-[#0c1017]/80 backdrop-blur-xl rounded-2xl mb-6 shadow-xl">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-base md:text-xl font-extrabold tracking-wide bg-gradient-to-r from-white via-slate-200 to-indigo-300 bg-clip-text text-transparent">
              Aegis-RAG
            </h1>
            <p className="text-[10px] md:text-xs text-slate-400">Enterprise Document Intelligence Engine</p>
          </div>
        </div>

        {/* Live Backend Connection Status */}
        <div className="flex items-center space-x-2 bg-slate-950/80 border border-slate-800 px-3 py-1.5 rounded-full text-xs">
          {checkingStatus ? (
            <span className="text-yellow-400 flex items-center gap-1.5 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span> Connecting...
            </span>
          ) : isConnected ? (
            <span className="text-emerald-400 flex items-center gap-1.5 text-[11px] font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> System Online
            </span>
          ) : (
            <button onClick={checkHealth} className="text-rose-400 flex items-center gap-1.5 hover:underline text-[11px]">
              <AlertCircle className="w-3.5 h-3.5" /> Retry Connection
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6 z-10">
        
        {/* Left Column: Upload & Ingestion */}
        <section className="bg-[#0c1017]/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 flex flex-col justify-between shadow-2xl">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <UploadCloud className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold text-sm tracking-wide text-slate-200">Document Ingestion</h2>
            </div>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Upload resumes, compliance specs, or governance PDFs. Documents are sanitized and vector-indexed automatically into ChromaDB.
            </p>

            {/* Action Buttons: Camera Snap + File Upload */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
              
              {/* Option A: Snap Live Photo via Mobile Camera */}
              <label className="group border border-emerald-500/30 hover:border-emerald-400/80 transition-all duration-200 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-emerald-950/20 active:scale-95 shadow-inner">
                <Camera className="w-6 h-6 text-emerald-400 group-hover:scale-110 transition-transform mb-1.5" />
                <span className="text-xs text-slate-200 font-semibold">Snap Live Doc</span>
                <span className="text-[10px] text-slate-500 mt-0.5">Use Phone Camera</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  capture="environment" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  disabled={isUploading} 
                />
              </label>

              {/* Option B: Choose File / PDF */}
              <label className="group border border-slate-700/80 hover:border-indigo-500/80 transition-all duration-200 rounded-xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-950/60 active:scale-95 shadow-inner">
                <FileText className="w-6 h-6 text-indigo-400 group-hover:scale-110 transition-transform mb-1.5" />
                <span className="text-xs text-slate-200 font-semibold">Select File</span>
                <span className="text-[10px] text-slate-500 mt-0.5">PDF or Saved Image</span>
                <input 
                  type="file" 
                  accept=".pdf,.png,.jpg,.jpeg" 
                  className="hidden" 
                  onChange={handleFileUpload} 
                  disabled={isUploading} 
                />
              </label>

            </div>

            {uploadStatus && (
              <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-mono text-[11px] truncate">{uploadStatus}</span>
              </div>
            )}
          </div>

          <div className="mt-6 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-indigo-400" /> ChromaDB Active</span>
            <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-emerald-400" /> Vision OCR Ready</span>
          </div>
        </section>

        {/* Right Column: Real-Time SSE Event Execution Logs */}
        <section className="bg-[#0c1017]/80 border border-slate-800/80 backdrop-blur-xl rounded-2xl p-5 flex flex-col justify-between shadow-2xl">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h2 className="font-semibold text-sm tracking-wide text-slate-200">LangGraph Pipeline Execution</h2>
            </div>

            {/* Stream Logs Output */}
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4 h-60 overflow-y-auto font-mono text-[11px] space-y-2.5 shadow-inner">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                  <Sparkles className="w-5 h-5 text-slate-700 animate-pulse" />
                  <span>Awaiting query execution...</span>
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="border-l-2 border-indigo-500 pl-2.5 py-0.5">
                    <span className="text-indigo-400 font-bold uppercase text-[10px]">{log.event}:</span>{" "}
                    <span className="text-slate-300">{log.data}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Query Form */}
          <form onSubmit={handleSendQuery} className="mt-4 flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type evaluation query (e.g., 'Check candidate skill match')..."
              className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-3.5 py-2.5 text-xs text-slate-200 placeholder-slate-600 outline-none transition font-mono"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={isStreaming || !query.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2.5 rounded-xl text-xs font-medium transition duration-200 disabled:opacity-40 flex items-center gap-1 active:scale-95 shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </section>

      </main>
    </div>
  );
}
