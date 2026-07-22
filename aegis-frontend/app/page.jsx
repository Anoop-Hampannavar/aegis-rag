"use client";

import React, { useState } from "react";
import { Upload, FileText, Send, ShieldCheck, Search, CheckCircle2 } from "lucide-react";

export default function Home() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [activeDoc, setActiveDoc] = useState(null);
  const [query, setQuery] = useState("");
  const [response, setResponse] = useState("Your search result or analysis will appear here...");
  const [loading, setLoading] = useState(false);

  const handleFileUpload = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
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
        setActiveDoc(data.filename || selectedFile.name);
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

    setLoading(true);

    try {
      const res = await fetch("https://aegis-backend.onrender.com/api/v1/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query, tau_threshold: 0.35 }),
      });

      const data = await res.json();
      setResponse(data.answer || data.result || "No response received from server.");
    } catch (err) {
      setResponse("⚠️ Error connecting to server.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 font-sans">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex items-center justify-between p-4 border border-slate-800 rounded-2xl bg-slate-900/60 backdrop-blur-md">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-600/20 border border-indigo-500/30 text-indigo-400">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="font-bold text-xl text-white">AEGIS Guardrail RAG</h1>
              <p className="text-xs text-slate-400">Self-Correcting Document Intelligence Engine</p>
            </div>
          </div>
        </header>

        {/* 2 Box Layout */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* BOX 1: Document Upload & Status */}
          <div className="p-6 border border-slate-800 rounded-2xl bg-slate-900/40 flex flex-col justify-between space-y-4">
            <div>
              <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4 flex items-center space-x-2">
                <FileText className="w-4 h-4 text-indigo-400" />
                <span>Document Ingestion</span>
              </h2>

              {/* Dotted Upload Box */}
              <label className="border-2 border-dashed border-slate-700 hover:border-indigo-500 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer bg-slate-950/50 transition duration-200 group">
                <Upload className="w-10 h-10 text-slate-500 group-hover:text-indigo-400 transition mb-3" />
                <p className="text-sm font-medium text-slate-300">
                  {uploading ? "Ingesting Document..." : "Click to Upload Document"}
                </p>
                <p className="text-xs text-slate-500 mt-1">PDF, PNG, JPG supported</p>
                <input 
                  type="file" 
                  accept=".pdf,.png,.jpg,.jpeg" 
                  onChange={handleFileUpload} 
                  className="hidden" 
                />
              </label>
            </div>

            {/* Active Document Status Indicator */}
            <div className="bg-slate-950 p-4 border border-slate-800 rounded-xl">
              <p className="text-xs text-slate-500 mb-1">Active Index Status:</p>
              {activeDoc ? (
                <div className="flex items-center space-x-2 text-emerald-400 text-sm font-medium">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="truncate">{activeDoc}</span>
                </div>
              ) : (
                <p className="text-sm text-slate-400 italic">No document loaded yet</p>
              )}
            </div>
          </div>

          {/* BOX 2: Search / Query Engine */}
          <div className="p-6 border border-slate-800 rounded-2xl bg-slate-900/40 flex flex-col justify-between space-y-4">
            <h2 className="text-sm font-semibold text-slate-300 uppercase tracking-wider flex items-center space-x-2">
              <Search className="w-4 h-4 text-indigo-400" />
              <span>Context Query Engine</span>
            </h2>

            {/* Result Display Output Box */}
            <div className="flex-1 min-h-[180px] bg-slate-950 p-4 rounded-xl border border-slate-800 text-sm text-slate-300 leading-relaxed font-mono overflow-y-auto">
              {loading ? (
                <p className="text-indigo-400 animate-pulse">Running retrieval & confidence validation...</p>
              ) : (
                response
              )}
            </div>

            {/* Prompt Input Form */}
            <form onSubmit={handleSendQuery} className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={activeDoc ? "Ask a question..." : "Upload document first..."}
                disabled={!activeDoc || loading}
                className="flex-1 bg-slate-950 border border-slate-800 focus:border-indigo-500 rounded-xl px-4 py-3 text-sm text-slate-100 placeholder-slate-500 outline-none disabled:opacity-50"
              />
              <button
                type="submit"
                disabled={!activeDoc || loading || !query.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-800 text-white px-5 rounded-xl transition flex items-center justify-center disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>

        </div>
      </div>
    </div>
  );
}
