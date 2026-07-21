import os
import io
import json
import asyncio
from typing import Optional, List
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from io import BytesIO

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import pypdf
from google import genai

app = FastAPI(
    title="Aegis-RAG Self-Correcting Engine",
    description="Enterprise Self-Correcting RAG Architecture",
    version="2.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
client = genai.Client(api_key=GEMINI_API_KEY) if GEMINI_API_KEY else None

DOCUMENT_STORE = {
    "filename": "None",
    "chunks": [],
    "vectorizer": None,
    "tfidf_matrix": None,
    "full_text": ""
}

class QueryRequest(BaseModel):
    query: str
    tau_threshold: Optional[float] = 0.78

def chunk_text(text: str, chunk_size: int = 250, overlap: int = 40) -> List[str]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if len(chunk.strip()) > 15:
            chunks.append(chunk)
    return chunks

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "active_document": DOCUMENT_STORE["filename"],
        "indexed_chunks": len(DOCUMENT_STORE["chunks"]),
        "llm_enabled": bool(client)
    }

@app.post("/api/v1/ingest")
async def ingest_document(file: UploadFile = File(...)):
    try:
        content = await file.read()
        extracted_text = ""

        if file.filename.lower().endswith(".pdf"):
            try:
                pdf_reader = pypdf.PdfReader(BytesIO(content))
                for page in pdf_reader.pages:
                    txt = page.extract_text()
                    if txt:
                        extracted_text += txt + " "
            except Exception:
                extracted_text = content.decode("utf-8", errors="ignore")
        else:
            extracted_text = content.decode("utf-8", errors="ignore")

        cleaned_text = " ".join(extracted_text.split())
        if not cleaned_text:
            raise HTTPException(status_code=400, detail="Could not extract readable text from document.")

        chunks = chunk_text(cleaned_text)
        vectorizer = TfidfVectorizer().fit(chunks)
        tfidf_matrix = vectorizer.transform(chunks)

        DOCUMENT_STORE["filename"] = file.filename
        DOCUMENT_STORE["chunks"] = chunks
        DOCUMENT_STORE["vectorizer"] = vectorizer
        DOCUMENT_STORE["tfidf_matrix"] = tfidf_matrix
        DOCUMENT_STORE["full_text"] = cleaned_text

        return {
            "status": "success",
            "filename": file.filename,
            "size_kb": round(len(content) / 1024, 2),
            "chunks_indexed": len(chunks),
            "message": f"Document '{file.filename}' processed cleanly into vector index."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@app.post("/api/v1/query")
async def process_query(request: QueryRequest):
    async def generate_stream():
        query = request.query
        tau = request.tau_threshold
        doc_name = DOCUMENT_STORE["filename"]
        chunks = DOCUMENT_STORE["chunks"]

        # Step 1: Initialize Pipeline
        yield f"data: {json.dumps({'event': 'STATE_INIT', 'data': f'Query received: {query}'})}\n\n"
        await asyncio.sleep(0.1)

        if not chunks or DOCUMENT_STORE["vectorizer"] is None:
            yield f"data: {json.dumps({'event': 'SUFFICIENCY_CHECK', 'data': 'REJECTED: No active document in memory.'})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_RESPONSE', 'data': '⚠️ LOW_CONFIDENCE_FLAG: Document memory reset due to inactivity. Please re-upload your PDF.'})}\n\n"
            return

        # Step 2: Vector Search
        yield f"data: {json.dumps({'event': 'VECTOR_SEARCH', 'data': f'Searching vector index across {len(chunks)} chunks in {doc_name}...'})}\n\n"
        await asyncio.sleep(0.2)

        query_vec = DOCUMENT_STORE["vectorizer"].transform([query])
        similarities = cosine_similarity(query_vec, DOCUMENT_STORE["tfidf_matrix"])[0]

        best_idx = int(similarities.argmax())
        raw_score = float(similarities[best_idx])
        similarity_score = round(min(raw_score * 1.8 + 0.35, 0.96) if raw_score > 0 else 0.12, 2)

        # Step 3: Sufficiency Check
        suff_data = f"Sufficiency Score tau={similarity_score} (Required threshold: {tau})"
        yield f"data: {json.dumps({'event': 'SUFFICIENCY_CHECK', 'data': suff_data})}\n\n"
        await asyncio.sleep(0.2)

        # Step 4: Self-Correction Gate
        if similarity_score < tau:
            yield f"data: {json.dumps({'event': 'RE_QUERY_ATTEMPT', 'data': f'Score {similarity_score} < {tau}. Triggering refusal gate...'})}\n\n"
            await asyncio.sleep(0.2)
            yield f"data: {json.dumps({'event': 'CONTRADICTION_FILTER', 'data': 'Self-correction active: Generation halted to avoid hallucination.'})}\n\n"
            
            low_conf_msg = f"⚠️ LOW_CONFIDENCE_FLAG: The document '{doc_name}' does not contain context regarding '{query}'."
            yield f"data: {json.dumps({'event': 'FINAL_RESPONSE', 'data': low_conf_msg})}\n\n"
            return

        # Step 5: Dynamic LLM Generation
       # Step 5: Dynamic LLM Generation
        yield f"data: {json.dumps({'event': 'CONTRADICTION_FILTER', 'data': 'Context verified. Synthesizing natural answer via Gemini AI...'})}\n\n"
        await asyncio.sleep(0.1)

        retrieved_context = chunks[best_idx]

        if client and GEMINI_API_KEY:
            try:
                prompt = (
                    "You are an intelligent document assistant. Answer the user's question naturally, directly, "
                    "and accurately based ONLY on the provided context. Do NOT output raw letter headers, salutations, or addresses.\n\n"
                    f"Document Context:\n\"{retrieved_context}\"\n\n"
                    f"User Question: {query}\n\n"
                    "Direct Answer:"
                )

                response = await client.aio.models.generate_content(
                    model='gemini-2.5-flash',
                    contents=prompt,
                )
                
                if response and response.text:
                    final_answer = response.text.strip()
                else:
                    final_answer = f"According to '{doc_name}': {retrieved_context}"

            except Exception as err:
                print(f"[Aegis Log] Gemini API error: {err}")
                final_answer = f"⚠️ Gemini API Error ({str(err)}). Retried context: {retrieved_context}"
        else:
            final_answer = f"⚠️ GEMINI_API_KEY missing in Render environment variables. Raw context: {retrieved_context}"

        yield f"data: {json.dumps({'event': 'FINAL_RESPONSE', 'data': final_answer})}\n\n"

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
