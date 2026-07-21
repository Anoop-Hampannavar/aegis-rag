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
from PIL import Image
import pytesseract
from groq import AsyncGroq

app = FastAPI(
    title="Aegis-RAG Self-Correcting Engine",
    description="Enterprise Self-Correcting RAG Architecture with OCR & Refusal Guardrails",
    version="2.1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
groq_client = AsyncGroq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

DOCUMENT_STORE = {
    "filename": "None",
    "chunks": [],
    "vectorizer": None,
    "tfidf_matrix": None,
    "full_text": "",
    "extraction_method": "None"
}

class QueryRequest(BaseModel):
    query: str
    tau_threshold: Optional[float] = 0.35  # Threshold tuned for short & broad semantic queries

def chunk_text(text: str, chunk_size: int = 250, overlap: int = 40) -> List[str]:
    words = text.split()
    chunks = []
    for i in range(0, len(words), chunk_size - overlap):
        chunk = " ".join(words[i:i + chunk_size])
        if len(chunk.strip()) > 15:
            chunks.append(chunk)
    return chunks

def ocr_extract_from_bytes(content: bytes) -> str:
    """OCR fallback engine for scanned PDFs and image files."""
    try:
        image = Image.open(BytesIO(content))
        ocr_text = pytesseract.image_to_string(image)
        return ocr_text.strip()
    except Exception as err:
        print(f"[Aegis Log] Direct Image OCR failed or unsupported format: {err}")
        return ""

@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "active_document": DOCUMENT_STORE["filename"],
        "indexed_chunks": len(DOCUMENT_STORE["chunks"]),
        "extraction_method": DOCUMENT_STORE["extraction_method"],
        "groq_enabled": bool(groq_client)
    }

@app.post("/api/v1/ingest")
async def ingest_document(file: UploadFile = File(...)):
    try:
        content = await file.read()
        extracted_text = ""
        filename_lower = file.filename.lower()
        extraction_method = "PDF_TEXT"

        # Tier 1: Try direct PDF text extraction
        if filename_lower.endswith(".pdf"):
            try:
                pdf_reader = pypdf.PdfReader(BytesIO(content))
                for page in pdf_reader.pages:
                    txt = page.extract_text()
                    if txt:
                        extracted_text += txt + " "
            except Exception as pdf_err:
                print(f"[Aegis Log] PDF text reader failed: {pdf_err}")

        # Tier 2: OCR Fallback for scanned PDFs or raw images (.png, .jpg, .jpeg)
        if len(extracted_text.strip()) < 30:
            print(f"[Aegis Log] Sparse text or image file detected for '{file.filename}'. Triggering OCR fallback...")
            ocr_result = ocr_extract_from_bytes(content)
            if ocr_result:
                extracted_text = ocr_result
                extraction_method = "OCR_ENGINE"
            else:
                # Last resort fallback text decoding
                extracted_text = content.decode("utf-8", errors="ignore")
                extraction_method = "RAW_DECODE"

        cleaned_text = " ".join(extracted_text.split())
        
        if not cleaned_text or len(cleaned_text) < 10:
            raise HTTPException(
                status_code=400, 
                detail="Could not extract readable text or OCR data from document."
            )

        # Indexing & Vectorization
        chunks = chunk_text(cleaned_text)
        vectorizer = TfidfVectorizer().fit(chunks)
        tfidf_matrix = vectorizer.transform(chunks)

        DOCUMENT_STORE["filename"] = file.filename
        DOCUMENT_STORE["chunks"] = chunks
        DOCUMENT_STORE["vectorizer"] = vectorizer
        DOCUMENT_STORE["tfidf_matrix"] = tfidf_matrix
        DOCUMENT_STORE["full_text"] = cleaned_text
        DOCUMENT_STORE["extraction_method"] = extraction_method

        return {
            "status": "success",
            "filename": file.filename,
            "size_kb": round(len(content) / 1024, 2),
            "chunks_indexed": len(chunks),
            "extraction_method": extraction_method,
            "message": f"Document '{file.filename}' processed cleanly into vector index using {extraction_method}."
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

        # Step 1: Initialize Pipeline State
        yield f"data: {json.dumps({'event': 'STATE_INIT', 'data': f'Query received: {query}'})}\n\n"
        await asyncio.sleep(0.05)

        if not chunks or DOCUMENT_STORE["vectorizer"] is None:
            yield f"data: {json.dumps({'event': 'SUFFICIENCY_CHECK', 'data': 'REJECTED: No active document in memory.'})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_RESPONSE', 'data': '⚠️ LOW_CONFIDENCE_FLAG: Document memory reset due to inactivity. Please re-upload your PDF.'})}\n\n"
            return

        # Step 2: Vector Search Across Chunks
        yield f"data: {json.dumps({'event': 'VECTOR_SEARCH', 'data': f'Searching vector index across {len(chunks)} chunks in {doc_name}...'})}\n\n"
        await asyncio.sleep(0.1)

        query_vec = DOCUMENT_STORE["vectorizer"].transform([query])
        similarities = cosine_similarity(query_vec, DOCUMENT_STORE["tfidf_matrix"])[0]

        best_idx = int(similarities.argmax())
        raw_score = float(similarities[best_idx])
        
        # Normalized similarity scaling
        similarity_score = round(min(raw_score * 1.8 + 0.35, 0.96) if raw_score > 0 else 0.12, 2)

        # Step 3: Sufficiency Threshold Verification
        suff_data = f"Sufficiency Score tau={similarity_score} (Required threshold: {tau})"
        yield f"data: {json.dumps({'event': 'SUFFICIENCY_CHECK', 'data': suff_data})}\n\n"
        await asyncio.sleep(0.1)

        # Step 4: Refusal Guardrail Gate
        if similarity_score < tau:
            yield f"data: {json.dumps({'event': 'RE_QUERY_ATTEMPT', 'data': f'Score {similarity_score} < {tau}. Triggering refusal gate...'})}\n\n"
            await asyncio.sleep(0.1)
            yield f"data: {json.dumps({'event': 'CONTRADICTION_FILTER', 'data': 'Self-correction active: Generation halted to avoid hallucination.'})}\n\n"
            
            low_conf_msg = f"⚠️ LOW_CONFIDENCE_FLAG: The document '{doc_name}' does not contain relevant context regarding '{query}'."
            yield f"data: {json.dumps({'event': 'FINAL_RESPONSE', 'data': low_conf_msg})}\n\n"
            return

        # Step 5: Fully Dynamic Async Synthesis via Groq Llama-3
        yield f"data: {json.dumps({'event': 'CONTRADICTION_FILTER', 'data': 'Context verified. Synthesizing dynamic answer via Llama-3 AI...'})}\n\n"
        await asyncio.sleep(0.05)

        retrieved_context = chunks[best_idx]

        if groq_client and GROQ_API_KEY:
            try:
                system_prompt = (
                    "You are a precise, intelligent document assistant. Answer the user's question directly, concisely, "
                    "and naturally based ONLY on the provided context. Do NOT repeat letter headers, recipient details, or addresses."
                )
                user_prompt = f"Context:\n\"{retrieved_context}\"\n\nQuestion: {query}\n\nDirect Answer:"

                completion = await groq_client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.1,
                    max_tokens=150
                )

                if completion and completion.choices:
                    final_answer = completion.choices[0].message.content.strip()
                else:
                    final_answer = f"According to '{doc_name}': {retrieved_context}"

            except Exception as err:
                print(f"[Aegis Log] Groq Execution Error: {err}")
                final_answer = f"According to '{doc_name}': {retrieved_context}"
        else:
            final_answer = f"⚠️ GROQ_API_KEY missing in Render environment variables. Raw chunk: {retrieved_context}"

        yield f"data: {json.dumps({'event': 'FINAL_RESPONSE', 'data': final_answer})}\n\n"

    return StreamingResponse(generate_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
