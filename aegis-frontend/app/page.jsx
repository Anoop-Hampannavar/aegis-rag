'use client';

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, AlertCircle, UploadCloud, Send, 
  FileText, Activity, Database, CheckCircle2, Cpu
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
    const selectedFile = e.target.files[0];
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
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col items-center p-4 md:p-8">
      {/* Header Banner */}
      <header className="w-full max-w-5xl flex items-center justify-between py-4 border-b border-slate-800 mb-8">
        <div className="flex items-center space-x-3">
          <ShieldCheck className="w-8 h-8 text-emerald-400" />
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-wide">Aegis-RAG</h1>
            <p className="text-xs text-slate-400">Enterprise Document Intelligence Engine</p>
          </div>
        </div>

        {/* Live Backend Connection Status */}
        <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full text-xs">
          {checkingStatus ? (
            <span className="text-yellow-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-yellow-400 animate-ping"></span> Connecting...
            </span>
          ) : isConnected ? (
            <span className="text-emerald-400 flex items-center gap-1.5 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span> System Online
            </span>
          ) : (
            <button onClick={checkHealth} className="text-rose-400 flex items-center gap-1.5 hover:underline">
              <AlertCircle className="w-3.5 h-3.5" /> Retry Connection
            </button>
          )}
        </div>
      </header>

      {/* Main Grid Layout */}
      <main className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Left Column: Upload & Ingestion */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <UploadCloud className="w-5 h-5 text-indigo-400" />
              <h2 className="font-semibold text-slate-200">Document Ingestion</h2>
            </div>
            <p className="text-xs text-slate-400 mb-6">
              Upload resumes, compliance specs, or governance PDFs. Documents are sanitized and vector-indexed automatically into ChromaDB.
            </p>

            <label className="border-2 border-dashed border-slate-700 hover:border-indigo-500 transition-colors rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-950/50">
              <FileText className="w-10 h-10 text-slate-500 mb-2" />
              <span className="text-sm text-slate-300 font-medium">Click to select PDF or Image</span>
              <span className="text-xs text-slate-500 mt-1">Tesseract OCR & PII Masking Active</span>
              <input type="file" className="hidden" onChange={handleFileUpload} disabled={isUploading} />
            </label>

            {uploadStatus && (
              <div className="mt-4 p-3 bg-slate-950 border border-slate-800 rounded text-xs text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{uploadStatus}</span>
              </div>
            )}
          </div>

          <div className="mt-8 pt-4 border-t border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <span className="flex items-center gap-1"><Database className="w-3.5 h-3.5" /> ChromaDB Active</span>
            <span className="flex items-center gap-1"><Cpu className="w-3.5 h-3.5" /> OCR Ready</span>
          </div>
        </section>

        {/* Right Column: Real-Time SSE Event Execution Logs */}
        <section className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <Activity className="w-5 h-5 text-emerald-400" />
              <h2 className="font-semibold text-slate-200">LangGraph Pipeline Execution</h2>
            </div>

            {/* Stream Logs Output */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 h-64 overflow-y-auto font-mono text-xs space-y-3">
              {logs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-slate-600">
                  Awaiting query execution...
                </div>
              ) : (
                logs.map((log, idx) => (
                  <div key={idx} className="border-l-2 border-indigo-500 pl-2">
                    <span className="text-indigo-400 font-bold uppercase">{log.event}:</span>{" "}
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
              className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
              disabled={isStreaming}
            />
            <button
              type="submit"
              disabled={isStreaming || !query.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </section>

      </main>
    </div>
  );
}
