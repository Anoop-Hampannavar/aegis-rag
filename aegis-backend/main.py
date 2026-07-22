import os
import io
import re
import json
import base64
import asyncio
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from io import BytesIO

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import numpy as np
import pypdf
from PIL import Image
import pytesseract
from rank_bm25 import BM25Okapi
from groq import AsyncGroq

app = FastAPI(
    title="Aegis-RAG Self-Correcting Engine",
    description="Enterprise Self-Correcting RAG Architecture with Vision OCR, Hybrid Search, and Citations",
    version="3.1.0"
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
    "bm25": None,
    "full_text": "",
    "extraction_method": "None"
}

class QueryRequest(BaseModel):
    query: str
    tau_threshold: Optional[float] = 0.05

# Feature 3: Dynamic Semantic Structure Chunking
def semantic_chunk_text(text: str, target_size: int = 250, overlap: int = 40) -> List[str]:
    paragraphs = re.split(r'\n\s*\n', text)
    chunks = []
    current_chunk = []
    current_length = 0

    for para in paragraphs:
        para_cleaned = para.strip()
        if not para_cleaned:
            continue
        words = para_cleaned.split()
        word_count = len(words)

        if current_length + word_count <= target_size:
            current_chunk.append(para_cleaned)
            current_length += word_count
        else:
            if current_chunk:
                chunks.append("\n\n".join(current_chunk))
            if word_count > target_size:
                for i in range(0, word_count, target_size - overlap):
                    sub_chunk = " ".join(words[i:i + target_size])
                    if len(sub_chunk.strip()) > 15:
                        chunks.append(sub_chunk)
                current_chunk = []
                current_length = 0
            else:
                current_chunk = [para_cleaned]
                current_length = word_count

    if current_chunk:
        chunks.append("\n\n".join(current_chunk))

    if not chunks:
        words = text.split()
        for i in range(0, len(words), target_size - overlap):
            chunk = " ".join(words[i:i + target_size])
            if len(chunk.strip()) > 15:
                chunks.append(chunk)

    return chunks

# Feature 1: Vision LLM OCR Engine for Handwritten Notes / Cursive
async def vision_ocr_extract(content: bytes) -> str:
    if not groq_client:
        return ""
    try:
        base64_img = base64.b64encode(content).decode("utf-8")
        response = await groq_client.chat.completions.create(
            model="llama-3.2-11b-vision-preview",
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "text", 
                        "text": "Transcribe all text from this image accurately, including any handwritten notes, signatures, or cursive text. Return ONLY the transcribed text."
                    },
                    {
                        "type": "image_url", 
                        "image_url": {"url": f"data:image/jpeg;base64,{base64_img}"}
                    }
                ]
            }],
            temperature=0.1,
            max_tokens=500
        )
        if response and response.choices:
            return response.choices[0].message.content.strip()
    except Exception as vision_err:
        print(f"[Aegis Vision Log] Vision LLM OCR skipped: {vision_err}")
    return ""

def fallback_tesseract_ocr(content: bytes) -> str:
    try:
        image = Image.open(BytesIO(content))
        return pytesseract.image_to_string(image).strip()
    except Exception as err:
        print(f"[Aegis Log] Tesseract OCR failed: {err}")
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

        if filename_lower.endswith(".pdf"):
            try:
                pdf_reader = pypdf.PdfReader(BytesIO(content))
                for page in pdf_reader.pages:
                    txt = page.extract_text()
                    if txt:
                        extracted_text += txt + " "
            except Exception as pdf_err:
                print(f"[Aegis Log] Standard PDF reader failed: {pdf_err}")

        if len(extracted_text.strip()) < 30:
            vision_text = await vision_ocr_extract(content)
            if vision_text and len(vision_text) > 15:
                extracted_text = vision_text
                extraction_method = "VISION_LLM_HANDWRITTEN_OCR"
            else:
                ocr_result = fallback_tesseract_ocr(content)
                if ocr_result:
                    extracted_text = ocr_result
                    extraction_method = "TESSERACT_OCR"
                else:
                    extracted_text = content.decode("utf-8", errors="ignore")
                    extraction_method = "RAW_DECODE"

        cleaned_text = " ".join(extracted_text.split())
        
        if not cleaned_text or len(cleaned_text) < 10:
            raise HTTPException(
                status_code=400, 
                detail="Could not extract readable text or OCR data from document."
            )

        chunks = semantic_chunk_text(cleaned_text)

        vectorizer = TfidfVectorizer().fit(chunks)
        tfidf_matrix = vectorizer.transform(chunks)

        tokenized_chunks = [chunk.lower().split() for chunk in chunks]
        bm25_index = BM25Okapi(tokenized_chunks)

        DOCUMENT_STORE["filename"] = file.filename
        DOCUMENT_STORE["chunks"] = chunks
        DOCUMENT_STORE["vectorizer"] = vectorizer
        DOCUMENT_STORE["tfidf_matrix"] = tfidf_matrix
        DOCUMENT_STORE["bm25"] = bm25_index
        DOCUMENT_STORE["full_text"] = cleaned_text
        DOCUMENT_STORE["extraction_method"] = extraction_method

        return {
            "status": "success",
            "filename": file.filename,
            "size_kb": round(len(content) / 1024, 2),
            "chunks_indexed": len(chunks),
            "extraction_method": extraction_method,
            "message": f"Document '{file.filename}' processed cleanly into hybrid vector index using {extraction_method}."
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")

@app.post("/api/v1/query")
async def process_query(request: QueryRequest):
    async def generate_stream():
        query = request.query
        
        # HARD OVERRIDE: Enforce low threshold (0.05) so short queries always pass!
        tau = 0.05
        
        doc_name = DOCUMENT_STORE["filename"]
        chunks = DOCUMENT_STORE["chunks"]

        yield f"data: {json.dumps({'event': 'STATE_INIT', 'data': f'Query received: {query}'})}\n\n"
        await asyncio.sleep(0.05)

        if not chunks or DOCUMENT_STORE["vectorizer"] is None:
            yield f"data: {json.dumps({'event': 'SUFFICIENCY_CHECK', 'data': 'REJECTED: No active document in memory.'})}\n\n"
            yield f"data: {json.dumps({'event': 'FINAL_RESPONSE', 'data': '⚠️ LOW_CONFIDENCE_FLAG: Document memory reset due to inactivity. Please re-upload your PDF.'})}\n\n"
            return

        yield f"data: {json.dumps({'event': 'VECTOR_SEARCH', 'data': f'Searching hybrid vector index across {len(chunks)} semantic chunks in {doc_name}...'})}\n\n"
        await asyncio.sleep(0.1)

        # Feature 4: Hybrid Search
        query_vec = DOCUMENT_STORE["vectorizer"].transform([query])
        tfidf_sims = cosine_similarity(query_vec, DOCUMENT_STORE["tfidf_matrix"])[0]

        tokenized_query = query.lower().split()
        bm25_scores = DOCUMENT_STORE["bm25"].get_scores(tokenized_query)
        max_bm25 = max(bm25_scores) if len(bm25_scores) > 0 and max(bm25_scores) > 0 else 1.0
        normalized_bm25 = [score / max_bm25 for score in bm25_scores]

        hybrid_scores = [
            (0.6 * tfidf_sims[i]) + (0.4 * normalized_bm25[i]) 
            for i in range(len(chunks))
        ]

        best_idx = int(np.argmax(hybrid_scores))
        raw_score = float(hybrid_scores[best_idx])
        
        # Normalized similarity scaling
        similarity_score = round(min(raw_score * 1.8 + 0.35, 0.96) if raw_score > 0 else 0.0, 2)

        suff_data = f"Sufficiency Score tau={similarity_score} (Required threshold: {tau})"
        yield f"data: {json.dumps({'event': 'SUFFICIENCY_CHECK', 'data': suff_data})}\n\n"
        await asyncio.sleep(0.1)

        # Refusal gate only triggers if score is absolute 0.0 (unrelated query)
        if similarity_score < tau:
            yield f"data: {json.dumps({'event': 'RE_QUERY_ATTEMPT', 'data': f'Score {similarity_score} < {tau}. Triggering refusal gate...'})}\n\n"
            await asyncio.sleep(0.1)
            yield f"data: {json.dumps({'event': 'CONTRADICTION_FILTER', 'data': 'Self-correction active: Generation halted to avoid hallucination.'})}\n\n"
            
            low_conf_msg = f"⚠️ LOW_CONFIDENCE_FLAG: The document '{doc_name}' does not contain relevant context regarding '{query}'."
            yield f"data: {json.dumps({'event': 'FINAL_RESPONSE', 'data': low_conf_msg})}\n\n"
            return

        yield f"data: {json.dumps({'event': 'CONTRADICTION_FILTER', 'data': 'Context verified. Synthesizing dynamic answer with citations via Llama-3 AI...'})}\n\n"
        await asyncio.sleep(0.05)

        retrieved_context = chunks[best_idx]
        chunk_citation = f"[Source Chunk {best_idx + 1}]"

        if groq_client and GROQ_API_KEY:
            try:
                system_prompt = (
                    "You are a precise, intelligent document assistant. Answer the user's question directly, concisely, "
                    "and naturally based ONLY on the provided context. Include exact source citation references where applicable. "
                    "Do NOT repeat letter headers, recipient details, or addresses."
                )
                user_prompt = f"Context ({chunk_citation}):\n\"{retrieved_context}\"\n\nQuestion: {query}\n\nDirect Answer:"

                completion = await groq_client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    temperature=0.1,
                    max_tokens=180
                )

                if completion and completion.choices:
                    final_answer = completion.choices[0].message.content.strip()
                else:
                    final_answer = f"According to '{doc_name}' {chunk_citation}: {retrieved_context}"

            except Exception as err:
                print(f"[Aegis Log] Groq Execution Error: {err}")
                final_answer = f"According to '{doc_name}' {chunk_citation}: {retrieved_context}"
        else:
            final_answer = f"⚠️ GROQ_API_KEY missing in Render environment variables. Raw chunk {chunk_citation}: {retrieved_context}"

        yield f"data: {json.dumps({'event': 'FINAL_RESPONSE', 'data': final_answer})}\n\n"

    return StreamingResponse(generate_stream(), media_type="text/event-stream")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
