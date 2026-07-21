'use client';

import React, { useState } from 'react';
import { Shield, Upload, Send, Cpu, CheckCircle, FileText, Activity } from 'lucide-react';

export default function AegisDashboard() {
  const [query, setQuery] = useState('');
  const [logs, setLogs] = useState([]);
  const [response, setResponse] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('');
  
  // Replace this with your live Render backend URL after deploying
 const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "https://aegis-rag-td6w.onrender.com";

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploadStatus('Ingesting & OCR Parsing...');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch(`${renderBackendUrl}/api/v1/ingest`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setUploadStatus(`Success: Ingested ${data.filename} (${data.characters_parsed} chars)`);
      } else {
        setUploadStatus(`Upload failed: ${data.detail}`);
      }
    } catch (err) {
      setUploadStatus('Error connecting to backend instance.');
    }
  };

  const handleStreamQuery = async (e) => {
    e.preventDefault();
    if (!query.trim() || isStreaming) return;

    setIsStreaming(true);
    setLogs([]);
    setResponse('');

    try {
      const res = await fetch(`${renderBackendUrl}/api/v1/query`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, tau_threshold: 0.78 }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder('utf-8');

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const payload = JSON.parse(line.replace('data: ', ''));
              if (payload.type === 'status') {
                setLogs((prev) => [...prev, payload.msg]);
              } else if (payload.type === 'token') {
                setResponse((prev) => prev + payload.token);
              }
            } catch (e) {
              // Ignore partial JSON chunks
            }
          }
        }
      }
    } catch (err) {
      setLogs((prev) => [...prev, 'Error executing streaming request.']);
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#090d16] text-slate-100 max-w-md mx-auto border-x border-slate-800 shadow-2xl">
      {/* Top Header */}
      <header className="p-4 bg-slate-900/80 backdrop-blur border-b border-slate-800 sticky top-0 z-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Shield className="w-6 h-6 text-emerald-400" />
          <div>
            <h1 className="font-bold text-base tracking-wide text-white">Aegis-RAG</h1>
            <p className="text-[10px] text-emerald-400 font-mono">IEEE 830 | GDPR Compliant</p>
          </div>
        </div>
        <div className="flex items-center gap-1 bg-emerald-950/60 text-emerald-400 px-2 py-1 rounded-full border border-emerald-800/50 text-[10px] font-mono">
          <Activity className="w-3 h-3 animate-pulse" />
          Hardware Ready
        </div>
      </header>

      {/* Main Body */}
      <main className="flex-1 p-4 space-y-4 overflow-y-auto">
        {/* File Upload Component */}
        <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl space-y-2">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5"><FileText className="w-4 h-4 text-emerald-400" /> Document Ingestion (OCR)</span>
            <span className="text-[10px] text-slate-500 font-mono">Tesseract + ChromaDB</span>
          </label>
          <div className="relative border-2 border-dashed border-slate-700 hover:border-emerald-500 rounded-lg p-3 text-center transition-colors">
            <input 
              type="file" 
              onChange={handleFileUpload} 
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
            />
            <Upload className="w-5 h-5 mx-auto text-slate-400 mb-1" />
            <p className="text-xs text-slate-400">Tap to upload resume/doc (PDF, Image)</p>
          </div>
          {uploadStatus && (
            <p className="text-[11px] font-mono text-emerald-400 bg-emerald-950/30 p-2 rounded border border-emerald-900/50">
              {uploadStatus}
            </p>
          )}
        </div>

        {/* Live LangGraph State Events Log */}
        {logs.length > 0 && (
          <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[11px] space-y-1">
            <p className="text-slate-400 font-bold border-b border-slate-800 pb-1 mb-2 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-blue-400" /> LangGraph Execution Events:
            </p>
            {logs.map((log, idx) => (
              <div key={idx} className="text-blue-300 flex items-start gap-1">
                <CheckCircle className="w-3 h-3 text-emerald-400 mt-0.5 shrink-0" />
                <span>{log}</span>
              </div>
            ))}
          </div>
        )}

        {/* Streaming Output Box */}
        {response && (
          <div className="p-4 bg-slate-900 border border-emerald-500/30 rounded-xl text-xs leading-relaxed space-y-2 shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2">
              <span className="font-semibold text-emerald-400 font-mono">Output Stream</span>
              <span className="text-[10px] text-slate-500 font-mono">Tau Threshold &gt;= 0.78</span>
            </div>
            <div className="text-slate-200 whitespace-pre-wrap font-sans">{response}</div>
          </div>
        )}
      </main>

      {/* Floating Query Footer */}
      <footer className="p-3 bg-slate-900 border-t border-slate-800 sticky bottom-0">
        <form onSubmit={handleStreamQuery} className="flex gap-2">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ask candidate query..."
            className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 font-sans"
          />
          <button
            type="submit"
            disabled={isStreaming}
            className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 text-white px-3 py-2 rounded-lg transition-colors flex items-center justify-center"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </footer>
    </div>
  );
}
