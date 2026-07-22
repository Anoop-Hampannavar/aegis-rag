# 🛡️ Aegis-RAG

> **Enterprise Self-Correcting RAG Engine with Multimodal Vision OCR & Zero-Hallucination Guardrails**

Aegis-RAG is a production-grade, self-correcting Retrieval-Augmented Generation (RAG) system engineered to eliminate LLM hallucinations on unstructured, messy documents. By combining **Groq Llama-3 Vision OCR**, **ChromaDB vector indexing**, an active **Context Sufficiency Threshold ($\tau \ge 0.78$)**, and **LangGraph SSE telemetry**, Aegis-RAG enforces grounded refusals whenever retrieved context is missing or incomplete.

---

## 🚀 Live Links & Demos

- **Live Web Application:** [https://aegis-rag.vercel.app](https://aegis-rag.vercel.app)
- **Backend API Service:** [https://aegis-rag-td6w.onrender.com](https://aegis-rag-td6w.onrender.com)

---

## ⚡ Key Architectural Features

- **📷 Multimodal OCR Ingestion:** Processes multi-page PDFs and live physical camera snaps via Groq Llama-3 Vision OCR, extracting structured text into clean vector embeddings.
- **🛡️ Active Sufficiency Check ($\tau \ge 0.78$):** Validates candidate vector relevance prior to synthesis. If retrieved context falls below the threshold, Aegis-RAG enforces a zero-hallucination grounded refusal.
- **📡 Real-Time SSE Telemetry:** Streams LangGraph state boundary logs character-by-character over Server-Sent Events (SSE) directly to the frontend.
- **📊 Interactive RAG Triad Evaluator:** Built-in telemetry dashboard computing live Groundedness Scores, Context Precision, and P95 Execution Latency dynamically for every query.
- **📈 Verified 0% Hallucination Rate:** Benchmarked against a 15-question evaluation suite (`eval.py`), reducing hallucination rates from ~40% (Naive RAG) down to **0%**.

---

## 🏗️ System Architecture
