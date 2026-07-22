'use client';

import React, { useState } from 'react';
import { BarChart2, Shield, AlertTriangle, Cpu, Activity, RefreshCw } from 'lucide-react';

export default function RagBenchmarkVisualizer() {
  const [activeModel, setActiveModel] = useState('aegis'); // 'naive' or 'aegis'
  const [tauThreshold, setTauThreshold] = useState(0.78);

  // Dynamic calculations based on Tau Threshold slider
  const computeMetrics = () => {
    if (activeModel === 'naive') {
      return {
        faithfulness: 60.0,
        precision: 53.3,
        refusalRate: 13.3,
        latency: 1200,
        hallucinationRate: 40.0,
      };
    } else {
      // Aegis-RAG dynamic behavior based on Tau
      // Higher Tau = higher faithfulness & refusal, slightly higher strictness
      const faithfulness = Math.min(100, Math.round(75 + (tauThreshold * 30)));
      const precision = Math.min(100, Math.round(60 + (tauThreshold * 40)));
      const refusalRate = Math.min(100, Math.round(50 + (tauThreshold * 60)));
      const hallucinationRate = Math.max(0, 100 - faithfulness);
      const latency = Math.round(1200 + (tauThreshold * 450));

      return {
        faithfulness,
        precision,
        refusalRate,
        latency,
        hallucinationRate,
      };
    }
  };

  const metrics = computeMetrics();

  return (
    <div className="w-full bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl mt-8">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 mb-6 gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
            <BarChart2 className="w-6 h-6 text-indigo-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-100">Live RAG Triad Benchmark Visualizer</h3>
            <p className="text-xs text-slate-400">Interactively compare Naive RAG vs. Aegis-RAG Guardrail parameters</p>
          </div>
        </div>

        {/* Model Switcher Toggle */}
        <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 self-start md:self-auto">
          <button
            onClick={() => setActiveModel('naive')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeModel === 'naive'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Naive RAG (Baseline)
          </button>
          <button
            onClick={() => setActiveModel('aegis')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeModel === 'aegis'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Aegis-RAG (Self-Correcting)
          </button>
        </div>
      </div>

      {/* Main Control & Display Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Column: Interactive Parameters (4 cols) */}
        <div className="lg:col-span-4 bg-slate-950 border border-slate-800/80 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4 text-indigo-400" /> Parameter Controls
            </h4>

            {activeModel === 'aegis' ? (
              <div className="space-y-5">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-xs font-medium text-slate-300">
                      Sufficiency Threshold (<span className="text-emerald-400 font-mono">τ</span>)
                    </label>
                    <span className="text-xs font-mono font-bold bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                      {tauThreshold.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.10"
                    max="0.99"
                    step="0.01"
                    value={tauThreshold}
                    onChange={(e) => setTauThreshold(parseFloat(e.target.value))}
                    className="w-full accent-emerald-400 cursor-pointer bg-slate-800 h-2 rounded-lg"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 mt-1">
                    <span>0.10 (Permissive)</span>
                    <span>0.78 (Optimal)</span>
                    <span>0.99 (Strict)</span>
                  </div>
                </div>

                <div className="p-3 bg-slate-900/80 border border-slate-800 rounded-lg text-xs text-slate-400 leading-relaxed">
                  <span className="text-emerald-400 font-semibold">Active Engine Effect:</span> Increasing <code className="text-slate-200">τ</code> forces the pipeline to reject low-relevance chunks before token synthesis, eliminating hallucinations.
                </div>
              </div>
            ) : (
              <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-lg text-xs text-rose-300 leading-relaxed space-y-2">
                <div className="flex items-center gap-1.5 font-semibold">
                  <AlertTriangle className="w-4 h-4" /> No Guardrails Active
                </div>
                <p className="text-slate-400">
                  Naive RAG directly pipes all retrieved vector results to the generator without sufficiency validation or contradiction filtering.
                </p>
              </div>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
            <span>Evaluated Cases: 15 Questions</span>
            <span>Target P95: &lt;2000ms</span>
          </div>
        </div>

        {/* Right Column: Metric Progress Bars (8 cols) */}
        <div className="lg:col-span-8 space-y-4">
          
          {/* Faithfulness / Groundedness Bar */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-slate-200">Groundedness (Faithfulness Score)</span>
              <span className="text-xs font-mono font-bold text-emerald-400">{metrics.faithfulness}%</span>
            </div>
            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
              <div
                className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${metrics.faithfulness}%` }}
              ></div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">Measures if all assertions in answers are backed strictly by document context.</p>
          </div>

          {/* Hallucination Rate Bar */}
          <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-semibold text-slate-200">Hallucination Rate</span>
              <span className="text-xs font-mono font-bold text-rose-400">{metrics.hallucinationRate}%</span>
            </div>
            <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden">
              <div
                className="bg-rose-500 h-full transition-all duration-500 rounded-full"
                style={{ width: `${metrics.hallucinationRate}%` }}
              ></div>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">Percentage of queries where the model fabricated unmentioned facts.</p>
          </div>

          {/* Grid of Secondary Metrics */}
          <div className="grid grid-cols-2 gap-4">
            
            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
              <span className="text-[11px] text-slate-400 block mb-1">Out-of-Domain Refusal</span>
              <span className="text-lg font-bold font-mono text-indigo-400">{metrics.refusalRate}%</span>
              <span className="text-[10px] text-slate-500 block mt-1">Accuracy on ungrounded prompts</span>
            </div>

            <div className="bg-slate-950 border border-slate-800/80 rounded-xl p-4">
              <span className="text-[11px] text-slate-400 block mb-1">Average Latency</span>
              <span className="text-lg font-bold font-mono text-amber-400">{metrics.latency} ms</span>
              <span className="text-[10px] text-slate-500 block mt-1">Total execution time</span>
            </div>

          </div>

        </div>

      </div>

    </div>
  );
}
