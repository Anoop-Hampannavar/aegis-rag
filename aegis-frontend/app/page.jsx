"use client";

import React, { useState, useRef, useEffect } from "react";
import { 
  Upload, FileText, Send, ShieldCheck, 
  Cpu, Activity, RefreshCw, Sparkles 
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
              // Ignore partial parse
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
    <div className="min-h-screen bg-[#07090e] text-cyan-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      
      {/* Sleek Top Glow Header */}
      <header className="border-b border-cyan-500/20 bg-[#0c1017]/80 backdrop-blur-xl sticky top-0 z-50 px-6 py-4 flex items-center justify-between shadow-[0_4px_20px_rgba(6,182,212,0.05)]">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.2)]">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="font-extrabold text-lg tracking-wider bg-gradient-to-r from-cyan-300 via-teal-200 to-emerald-400 bg-clip-text text-transparent">
              AEGIS // GUARDRAIL RAG
            </h1>
            <p className="text-[11px] text-cyan-500/80 font-mono tracking-wide">SELF-CORRECTING AI ENGINE v3.2</p>
          </div>
        </div>

        {/* Upload & Engine Status */}
        <div className="flex items-center space-x-4">
          <div className="hidden md:flex items-center space-x-2 bg-cyan-950/40 border border-cyan-800/40 px-3.5 py-1.5 rounded-xl text-xs font-mono">
            <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span className="text-cyan-500">ENGINE:</span>
            <span className="text-cyan-200 font-semibold">GROQ LLAMA-3.1 + VISION OCR</span>
          </div>

          <label className="cursor-pointer inline-flex items-center space-x-2 bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 text-black text-xs font-bold px-4 py-2.5 rounded-xl transition-all duration-200 shadow-[0_0_20px_rgba(6,182,212,0.3)] active:scale-95">
            <Upload className="w-4 h-4" />
            <span>{uploading ? "INGESTING..." : "UPLOAD DOCUMENT"}</span>
            <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={handleFileUpload} className="hidden" />
          </label>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6 flex flex-col md:flex-row gap-6">
        
        {/* Left Column: Active Document & Live Telemetry */}
        <div className="w-full md:w-80 flex flex-col gap-4">
          
          {/* Active Index Card */}
          <div className="bg-[#0d121c]/60 border border-cyan-500/20 rounded-2xl p-4 backdrop-blur-md shadow-lg">
            <h2 className="text-xs font-bold text-cyan-400/80 uppercase tracking-widest mb-3 flex items-center space-x-2 font-mono">
              <FileText className="w-4 h-4 text-cyan-400" />
              <span>ACTIVE INDEX</span>
            </h2>

            {activeDoc ? (
              <div className="bg-[#080b11] border border-cyan-500/30 rounded-xl p-3">
                <p className="font-bold text-sm text-cyan-200 truncate">{activeDoc}</p>
                <div className="mt-2.5 flex items-center justify-between text-xs font-mono">
                  <span className="text-cyan-500/80">PIPELINE:</span>
                  <span className="px-2 py-0.5 rounded-md bg-cyan-950 text-cyan-300 font-bold text-[10px] border border-cyan-500/30">
                    {extractionMethod || "PDF_TEXT"}
                  </span>
                </div>
              </div>
            ) : (
              <div className="text-center py-6 border border-dashed border-cyan-900/60 rounded-xl text-cyan-600/70 text-xs font-mono">
                NO DOCUMENT LOADED
              </div>
            )}
          </div>

          {/* Live Telemetry Sidebar */}
          <div className="bg-[#0d121c]/60 border border-cyan-500/20 rounded-2xl p-4 backdrop-blur-md flex-1 flex flex-col shadow-lg">
            <h2 className="text-xs font-bold text-emerald-400 uppercase tracking-widest mb-3 flex items-center space-x-2 font-mono">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>REAL-TIME TELEMETRY</span>
            </h2>

            <div className="flex-1 space-y-2 overflow-y-auto max-h-[360px] pr-1">
              {currentSteps.length > 0 ? (
                currentSteps.map((step, idx) => (
                  <div key={idx} className="bg-[#080b11] border border-cyan-800/40 rounded-xl p-2.5 text-xs animate-fadeIn">
                    <span className="font-mono text-[10px] text-cyan-400 font-bold block uppercase mb-0.5">
                      {step.event}
                    </span>
                    <p className="text-cyan-200/80 font-mono text-[11px] leading-relaxed">{step.data}</p>
                  </div>
                ))
              ) : (
                <div className="text-center py-12 text-cyan-800 text-xs font-mono">
                  AWAITING QUERY EXECUTION...
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Full Chat Interface with User Queries & AI Responses */}
        <div className="flex-1 bg-[#0d121c]/60 border border-cyan-500/20 rounded-2xl backdrop-blur-md flex flex-col h-[650px] overflow-hidden shadow-2xl">
          
          {/* Chat Stream Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-cyan-700/80 space-y-3">
                <div className="p-4 rounded-2xl bg-[#080b11] border border-cyan-800/40 text-cyan-400 shadow-[0_0_20px_rgba(6,182,212,0.1)]">
                  <Sparkles className="w-8 h-8 text-cyan-400" />
                </div>
                <p className="text-sm font-semibold text-cyan-300">Ask any question about your document.</p>
                <p className="text-xs text-cyan-600 max-w-sm font-mono">
                  Out-of-context queries automatically trigger the <code className="text-amber-400">LOW_CONFIDENCE_FLAG</code> guardrail.
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
                        ? "bg-gradient-to-r from-cyan-600 to-teal-600 text-white rounded-br-none shadow-lg shadow-cyan-900/30 font-medium"
                        : msg.content.includes("⚠️ LOW_CONFIDENCE_FLAG")
                        ? "bg-amber-950/50 border border-amber-500/50 text-amber-200 rounded-bl-none shadow-lg shadow-amber-950/20"
                        : "bg-[#080b11] border border-cyan-500/30 text-cyan-100 rounded-bl-none shadow-md"
                    }`}
                  >
                    <span className="text-[10px] font-mono uppercase block font-bold mb-1 opacity-60">
                      {msg.role === "user" ? "USER QUERY" : "AEGIS SYNTHESIS"}
                    </span>
                    {msg.content}
                  </div>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>

          {/* User Input Bar */}
          <form onSubmit={handleSendQuery} className="p-4 border-t border-cyan-500/20 bg-[#080b11]/80 flex items-center gap-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={activeDoc ? `Ask about '${activeDoc}'...` : "Upload a document first..."}
              disabled={!activeDoc || loading}
              className="flex-1 bg-[#0d121c] border border-cyan-500/30 focus:border-cyan-400 rounded-xl px-4 py-3 text-sm text-cyan-100 placeholder-cyan-700 outline-none transition duration-200 disabled:opacity-40"
            />
            <button
              type="submit"
              disabled={!activeDoc || loading || !query.trim()}
              className="bg-gradient-to-r from-cyan-500 to-teal-500 hover:from-cyan-400 hover:to-teal-400 disabled:from-gray-800 disabled:to-gray-800 text-black font-bold p-3 rounded-xl transition duration-200 shadow-lg shadow-cyan-500/20 active:scale-95 disabled:text-gray-600"
            >
              {loading ? <RefreshCw className="w-5 h-5 animate-spin text-cyan-400" /> : <Send className="w-5 h-5" />}
            </button>
          </form>

        </div>

      </main>
    </div>
  );
}
