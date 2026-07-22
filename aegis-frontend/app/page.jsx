"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Terminal, ShieldAlert, Cpu, Radio, Upload, 
  Send, Database, CheckCircle, Zap, RefreshCw 
} from "lucide-react";

export default function AegisCommandCenter() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeDoc, setActiveDoc] = useState(null);
  const [extractionMethod, setExtractionMethod] = useState("");
  
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [telemetryLogs, setTelemetryLogs] = useState([]);
  
  const logsEndRef = useRef(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [telemetryLogs, messages]);

  const handleFileUpload = async (e) => {
    if (!e.target.files?.[0]) return;
    const selectedFile = e.target.files[0];
    setFile(selectedFile);
    setUploading(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const res = await fetch("https://aegis-backend.onrender.com/api/v1/ingest", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok) {
        setActiveDoc(data.filename);
        setExtractionMethod(data.extraction_method);
        setTelemetryLogs((prev) => [
          ...prev, 
          `[SYS_INGEST] Document '${data.filename}' indexed cleanly via ${data.extraction_method}`
        ]);
      } else {
        alert(data.detail || "Upload failed");
      }
    } catch (err) {
      alert("Error connecting to backend server.");
    } finally {
      setUploading(false);
    }
  };

  const handleSendQuery = async (e) => {
    e.preventDefault();
    if (!query.trim() || loading) return;

    const userMsg = { id: Date.now().toString(), role: "user", text: query };
    setMessages((prev) => [...prev, userMsg]);
    const currentQuery = query;
    setQuery("");
    setLoading(true);

    setTelemetryLogs((prev) => [...prev, `[USER_QUERY] Execution launched: "${currentQuery}"`]);

    try {
      const response = await fetch("https://aegis-backend.onrender.com/api/v1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: currentQuery, tau_threshold: 0.35 }),
      });

      if (!response.body) return;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const payload = JSON.parse(line.replace("data: ", ""));
              
              if (payload.event === "FINAL_RESPONSE") {
                assistantText = payload.data;
              } else {
                setTelemetryLogs((prev) => [
                  ...prev, 
                  `[${payload.event}] ${payload.data}`
                ]);
              }
            } catch (pErr) {
              // Parse fallback
            }
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", text: assistantText },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: "assistant", text: "⚠️ SERVER_COMMUNICATION_ERROR" },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-cyan-400 font-mono p-4 flex flex-col gap-4 selection:bg-cyan-500 selection:text-black">
      
      {/* HUD Header Bar */}
      <header className="border-2 border-cyan-500/40 bg-cyan-950/20 rounded-lg p-4 flex flex-col md:flex-row items-center justify-between gap-4 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
        <div className="flex items-center gap-3">
          <div className="p-2 border border-cyan-400 bg-cyan-500/10 rounded animate-pulse">
            <Radio className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-xl font-black tracking-widest text-cyan-300">AEGIS // COMMAND CENTER</h1>
            <p className="text-[10px] text-cyan-600 uppercase tracking-wider">Self-Correcting RAG Architecture v3.2</p>
          </div>
        </div>

        {/* Live HUD Status Indicators */}
        <div className="flex items-center gap-6 text-xs">
          <div className="flex items-center gap-2">
            <Cpu className="w-4 h-4 text-emerald-400" />
            <span className="text-slate-400">CORE:</span>
            <span className="text-emerald-400 font-bold">GROQ LLAMA-3</span>
          </div>

          <label className="cursor-pointer border border-cyan-400/60 bg-cyan-900/30 hover:bg-cyan-500/20 text-cyan-300 px-4 py-2 rounded text-xs font-bold transition flex items-center gap-2 shadow-[0_0_10px_rgba(6,182,212,0.2)] active:scale-95">
            <Upload className="w-4 h-4" />
            <span>{uploading ? "INGESTING..." : "LOAD DOCUMENT"}</span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </header>

      {/* Main Grid View */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4">
        
        {/* Top/Left Section: System Telemetry Console */}
        <div className="lg:col-span-5 border border-cyan-500/30 bg-black/80 rounded-lg p-4 flex flex-col gap-3 shadow-inner">
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
              <Terminal className="w-4 h-4" />
              <span>SYSTEM LOGS & TELEMETRY</span>
            </div>
            <span className="text-[10px] text-cyan-600">LIVE FEED</span>
          </div>

          {/* Active Document Status Panel */}
          <div className="border border-cyan-900 bg-cyan-950/30 rounded p-3 text-xs flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Database className="w-4 h-4 text-cyan-400" />
              <span className="text-slate-300 font-bold truncate max-w-[180px]">
                {activeDoc || "NO_ACTIVE_INDEX"}
              </span>
            </div>
            <span className="text-[10px] bg-cyan-900/60 border border-cyan-500/30 px-2 py-0.5 rounded text-cyan-300">
              {extractionMethod || "IDLE"}
            </span>
          </div>

          {/* Telemetry Log Output Terminal */}
          <div className="flex-1 bg-black border border-cyan-900 rounded p-3 overflow-y-auto max-h-[380px] space-y-1.5 text-[11px]">
            {telemetryLogs.length === 0 ? (
              <p className="text-cyan-800 text-center py-12">SYSTEM_IDLE // READY FOR INPUT</p>
            ) : (
              telemetryLogs.map((log, i) => (
                <div key={i} className="text-cyan-400 font-mono leading-tight">
                  <span className="text-cyan-700">&gt;</span> {log}
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </div>

        {/* Right Section: Interactive Query Output Stream */}
        <div className="lg:col-span-7 border border-cyan-500/30 bg-black/80 rounded-lg p-4 flex flex-col justify-between shadow-inner">
          
          <div className="flex items-center justify-between border-b border-cyan-500/20 pb-2 mb-4">
            <div className="flex items-center gap-2 text-xs font-bold text-cyan-300">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>AEGIS QUERY TERMINAL</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-bold">GUARDRAIL ACTIVE</span>
          </div>

          {/* Chat / Command Stream */}
          <div className="flex-1 overflow-y-auto space-y-4 max-h-[420px] pr-2 mb-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-cyan-800 space-y-2">
                <ShieldAlert className="w-12 h-12 text-cyan-900 animate-pulse" />
                <p className="text-xs tracking-widest">AWAITING COMMAND ENTRY...</p>
              </div>
            ) : (
              messages.map((m) => (
                <div key={m.id} className={`flex flex-col ${m.role === "user" ? "items-end" : "items-start"}`}>
                  <div className={`p-3 rounded border text-xs max-w-[90%] leading-relaxed ${
                    m.role === "user" 
                      ? "border-cyan-400 bg-cyan-950/40 text-cyan-200" 
                      : m.text.includes("⚠️ LOW_CONFIDENCE_FLAG")
                      ? "border-amber-500 bg-amber-950/40 text-amber-300"
                      : "border-cyan-800 bg-black text-slate-200"
                  }`}>
                    <span className="text-[9px] uppercase block font-bold mb-1 opacity-60">
                      [{m.role === "user" ? "OPERATOR" : "AEGIS_AI"}]
                    </span>
                    {m.text}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Terminal Input Line */}
          <form onSubmit={handleSendQuery} className="flex gap-2">
            <div className="flex-1 border border-cyan-500/40 bg-black rounded flex items-center px-3 gap-2 focus-within:border-cyan-400">
              <span className="text-cyan-500 font-bold text-sm">&gt;</span>
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={activeDoc ? "Type prompt..." : "Upload document first..."}
                disabled={!activeDoc || loading}
                className="w-full bg-transparent outline-none text-xs text-cyan-200 placeholder-cyan-800 py-3"
              />
            </div>
            <button
              type="submit"
              disabled={!activeDoc || loading || !query.trim()}
              className="border border-cyan-400 bg-cyan-500/20 hover:bg-cyan-500/40 disabled:opacity-30 text-cyan-300 px-6 rounded font-bold text-xs transition flex items-center gap-2 active:scale-95"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>

        </div>

      </div>
    </div>
  );
}
