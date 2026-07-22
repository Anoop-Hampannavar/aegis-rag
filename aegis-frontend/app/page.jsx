"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, FileText, Send, ShieldCheck, 
  Cpu, Activity, RefreshCw 
} from "lucide-react";

export default function AegisDashboard() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeDoc, setActiveDoc] = useState(null);
  const [extractionMethod, setExtractionMethod] = useState("");
  
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [currentSteps, setCurrentSteps] = useState([]);
  
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentSteps]);

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

    const userMessage = {
      id: Date.now().toString(),
      role: "user",
      content: query,
    };

    setMessages((prev) => [...prev, userMessage]);
    const currentQuery = query;
    setQuery("");
    setLoading(true);
    setCurrentSteps([]);

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
      let stepsBuffer = [];

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
                stepsBuffer.push({ event: payload.event, data: payload.data });
                setCurrentSteps([...stepsBuffer]);
              }
            } catch (pErr) {
              // Ignore partial parse chunks
            }
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: assistantText,
          steps: stepsBuffer,
        },
      ]);
      setCurrentSteps([]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: "assistant",
          content: "⚠️ Server connection error while processing stream.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      {/* Top Navigation Bar */}
      <header className="border-b border-slate-800/80 bg-slate-900/50 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-bold text-lg tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-400 bg-clip-text text-transparent">
              AEGIS-RAG
            </h1>
            <p className="text-xs text-slate-400">Self-Correcting Enterprise Guardrail Engine</p>
          </div>
        </div>

        {/* Live Document Status Badge */}
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-2 bg-slate-900/80 border border-slate-800 px-3 py-1.5 rounded-lg text-xs">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-slate-400">Engine:</span>
            <span className="text-slate-200 font-medium">Groq Llama-3.1 + Vision OCR</span>
          </div>

          <label className="cursor-pointer inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-lg transition-all duration-200 shadow-lg shadow-indigo-600/20 active:scale-95">
            <Upload className="w-4 h-4" />
            <span>{uploading ? "Ingesting..." : "Upload Document"}</span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
        
        {/* Left Sidebar: Document Metadata & Active Pipeline State */}
        <div className="w-full md:w-80 flex flex-col gap-4">
          
          {/* Active Document Card */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center space-x-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Active Index</span>
            </h2>

            {activeDoc ? (
              <div className="bg-slate-950/60 border border-slate-800 rounded-xl p-3">
                <p className="font-semibold text-sm text-slate-200 truncate">{activeDoc}</p>
                <div className="mt-2 flex items-center justify-between text-xs">
                  <span className="text-slate-400">OCR Pipeline:</span>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-300 font-mono text-[10px] border border-indigo-800/50">
                    {extractionMethod || "PDF_TEXT"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-slate-800 rounded-xl text-slate-500 text-xs">
                No document loaded. Upload a PDF or scan to begin.
              </div>
            )}
          </div>

          {/* Real-time Pipeline Execution Telemetry */}
          <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 backdrop-blur-sm flex-1 flex flex-col">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>Live Telemetry</span>
            </h2>

            <div className="flex-1 space-y-2 overflow-y-auto max-h-[350px] pr-1">
              {currentSteps.length > 0 ? (
                currentSteps.map((step, idx) => (
                  <div key={idx} className="bg-slate-950/80 border border-slate-800/60 rounded-lg p-2.5 text-xs animate-fadeIn">
                    <span className="font-mono text-[10px] text-indigo-400 font-bold block uppercase mb-0.5">
                      {step.event}
                    </span>
                    <p className="text-slate-300 font-mono text-[11px] leading-relaxed">{step.data}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-slate-600 text-xs font-mono">
                  Awaiting query execution...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Section: Chat Interface */}
        <div className="flex-1 bg-slate-900/40 border border-slate-800/80 rounded-2xl backdrop-blur-sm flex flex-col h-[650px] overflow-hidden">
          
          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-3">
                <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
                  <ShieldCheck className="w-8 h-8 text-indigo-400" />
                </div>
                <p className="text-sm">Ask any question about your document.</p>
                <p className="text-xs text-slate-600 max-w-sm">
                  Out-of-context prompts automatically trigger the <code className="text-indigo-400">LOW_CONFIDENCE_FLAG</code> guardrail.
                </p>
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-indigo-600 text-white rounded-br-none shadow-md shadow-indigo-600/10"
                        : msg.content.includes("⚠️ LOW_CONFIDENCE_FLAG")
                        ? "bg-amber-950/40 border border-amber-800/50 text-amber-200 rounded-bl-none"
                        : "bg-slate-950 border border-slate-800 text-slate-200 rounded-bl-none shadow-sm"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Prompt Input Footer */}
          <form onSubmit={handleSendQuery} className="p-4 border-t border-slate-800/80 bg-slate-950/50 flex items-center gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeDoc ? `Ask about '${activeDoc}'...` : "Upload a document first..."}
              disabled={!activeDoc || loading}
              className="flex-1 bg-slate-900 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none transition duration-200 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!activeDoc || loading || !query.trim()}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 disabled:text-slate-600 text-white p-3 rounded-xl transition duration-200 shadow-md shadow-indigo-600/20 active:scale-95"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </form>
        </div>

      </main>
    </div>
  );
}
