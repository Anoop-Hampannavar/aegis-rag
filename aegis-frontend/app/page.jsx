'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, AlertCircle, UploadCloud, Send, 
  FileText, Activity, Database, CheckCircle2, Cpu, Sparkles
} from 'lucide-react';

const BACKEND_URL = "https://aegis-backend.onrender.com";

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
    const selectedFile = e.target.files[0];
    if (!selectedFile) return;

    setFile(selectedFile);
    setIsUploading(true);
    setUploadStatus("Ingesting document into vector storage...");

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
      setUploadStatus("Error uploading document to backend server.");
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
        body: JSON.stringify({ query, tau_threshold: 0.35 }),
      });

      if (!res.body) return;

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
    <div className="min-h-screen bg-[#07090e] text-slate-100 font-sans flex flex-col items-center p-3 md:p-8 selection:bg-cyan-500 selection:text-black">
      
      {/* Glow Ambient Lights */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-cyan-500/10 blur-[120px] pointer-events-none rounded-full"></div>
      <div className="fixed bottom-0 right-0 w-80 h-80 bg-indigo-500/10 blur-[120px] pointer-events-none rounded-full"></div>

      {/* Header Banner */}
      <header className="w-full max-w-4xl flex items-center justify-between py-3 px-4 border border-cyan-500/20 bg-[#0c1017]/80 backdrop-blur-xl rounded-2xl mb-6 shadow-[0_4px_25px_rgba(6,182,212,0.1)]">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <ShieldCheck className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-base md:text-xl font-extrabold tracking-wider bg-gradient-to-r from-cyan-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent">
              AEGIS // RAG
            </h1>
            <p className="text-[10px] text-cyan-500/80 font-mono tracking-tight">ENTERPRISE INTELLIGENCE ENGINE</p>
          </div>
        </div>

        {/* Live Connection Pill */}
        <div className="flex items-center space-x-2 bg-black/40 border border-cyan-500/20 px-3 py-1 rounded-full text-xs font-mono">
          {checkingStatus ? (
            <span className="text-yellow-400 flex items-center gap-1.5 text-[11px]">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span> Connecting
            </span>
          ) : isConnected ? (
            <span className="text-emerald-400 flex items-center gap-1.5 text-[11px] font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> ONLINE
            </span>
          ) : (
            <button onClick={checkHealth} className="text-rose-400 flex items-center gap-1 hover:underline text-[11px]">
              <AlertCircle className="w-3.5 h-3.5" /> Retry
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 gap-5 z-10">
        
        {/* Left Card: Document Upload Zone */}
        <section className="bg-[#0c1017]/70 border border-cyan-500/20 backdrop-blur-xl rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <UploadCloud className="w-5 h-5 text-cyan-400" />
              <h2 className="font-bold text-sm tracking-wide text-cyan-200">DOCUMENT INGESTION</h2>
            </div>
            <p className="text-xs text-slate-400 mb-5 leading-relaxed">
              Upload PDF or image files to index into ChromaDB automatically.
            </p>

            {/* Dotted Glowing Dropzone */}
            <label className="group relative border-2 border-dashed border-cyan-500/30 hover:border-cyan-400/80 transition-all duration-300 rounded-xl p-6 flex flex-col items-center justify-center cursor-pointer bg-black/40 hover:bg-cyan-950/20 shadow-[0_0_15px_rgba(6,182,212,0.05)] active:scale-95">
              <div className="p-3 rounded-full bg-cyan-500/10 group-hover:scale-110 transition duration-300 mb-2">
                <FileText className="w-7 h-7 text-cyan-400" />
              </div>
              <span className="text-xs text-cyan-200 font-bold tracking-wide">
                {isUploading ? "INGESTING FILE..." : "CLICK TO CHOOSE FILE"}
              </span>
              <span className="text-[10px] text-slate-500 mt-1 font-mono">Vision OCR & PII Masking Active</span>
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>

            {uploadStatus && (
              <div className="mt-4 p-3 bg-black/60 border border-cyan-500/30 rounded-xl text-xs text-cyan-200 flex items-center gap-2 animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-mono text-[11px] truncate">{uploadStatus}</span>
              </div>
            )}
          </div>

          <div className="mt-6 pt-3 border-t border-cyan-500/10 flex items-center justify-between text-[11px] font-mono text-slate-500">
            <span className="flex items-center gap-1.5"><Database className="w-3.5 h-3.5 text-cyan-500" /> ChromaDB Active</span>
            <span className="flex items-center gap-1.5"><Cpu className="w-3.5 h-3.5 text-emerald-400" /> OCR Engine</span>
          </div>
        </section>

        {/* Right Card: Real-time Telemetry & Query Stream */}
        <section className="bg-[#0c1017]/70 border border-cyan-500/20 backdrop-blur-xl rounded-2xl p-5 flex flex-col justify-between shadow-xl">
          <div>
            <div className="flex items-center space-x-2 mb-3">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h2 className="font-bold text-sm tracking-wide text-cyan-200">LANGGRAPH TELEMETRY</h2>
            </div>

            {/* Glowing Execution Logs Screen */}
            <div className="bg-black/80 border border-cyan-500/30 rounded-xl p-3 h-60 overflow-y-auto font-mono text-[11px] space-y-2.5 shadow-inner">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-600 gap-2">
                  <Sparkles className="w-6 h-6 text-cyan-950 animate-pulse" />
                  <span>Awaiting execution stream...</span>
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="border-l-2 border-cyan-500 pl-2.5 py-0.5 leading-relaxed">
                    <span className="text-cyan-400 font-bold uppercase tracking-wider text-[10px]">{log.event}:</span>{" "}
                    <span className="text-slate-200">{log.data}</span>
                  </div>
                ))
              )}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Futuristic Mobile-First Query Input */}
          <form onSubmit={handleSendQuery} className="mt-4 flex gap-2">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Ask context query..."
              className="flex-1 bg-black/60 border border-cyan-500/30 focus:border-cyan-400 rounded-xl px-3.5 py-2.5 text-xs text-cyan-100 placeholder-slate-600 outline-none transition duration-200 font-mono focus:ring-1 focus:ring-cyan-400"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={isStreaming || !query.trim()}
              className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-black font-extrabold px-4 py-2.5 rounded-xl transition duration-200 shadow-lg shadow-cyan-500/20 active:scale-95 disabled:opacity-40 flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </section>

      </main>
    </div>
  );
}
