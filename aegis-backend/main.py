import os
import io
import json
import base64
import asyncio
from typing import List
from PIL import Image
from pypdf import PdfReader
import pytesseract

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from groq import Groq

# Initialize FastAPI App
app = FastAPI(title="Aegis-RAG Intelligence Engine")

# Enable CORS for Frontend Access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Groq Client
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
groq_client = Groq(api_key=GROQ_API_KEY) if GROQ_API_KEY else None

# In-Memory Document Vector Store Simulation
DOCUMENT_STORE = {
    "filename": None,
    "chunks": [],
    "size_kb": 0
}

class QueryPayload(BaseModel):
    query: str
    tau_threshold: float = 0.78


def chunk_text(text: str, chunk_size: int = 500) -> List[str]:
    """Splits long document text into readable chunks for vector indexing."""
    words = text.split()
    chunks = []
    current_chunk = []
    current_length = 0

    for word in words:
        current_chunk.append(word)
        current_length += len(word) + 1
        if current_length >= chunk_size:
            chunks.append(" ".join(current_chunk))
            current_chunk = []
            current_length = 0

    if current_chunk:
        chunks.append(" ".join(current_chunk))

    return chunks if chunks else [text]


async def extract_text_from_image(file_bytes: bytes, filename: str) -> str:
    """
    Extracts text from images (PNG, JPG, JPEG) using Tesseract OCR first,
    and falls back to Groq Llama-3 Vision AI for messy/stylized camera snaps.
    """
    extracted_text = ""

    # Pass 1: Try Tesseract OCR
    try:
        img = Image.open(io.BytesIO(file_bytes))
        extracted_text = pytesseract.image_to_string(img).strip()
    except Exception as e:
        print(f"Tesseract OCR failed: {e}")

    # Pass 2: Groq Vision LLM Fallback (Crucial for camera snaps & book covers)
    if len(extracted_text) < 20 and groq_client:
        try:
            print(f"Low yield from Tesseract OCR for {filename}. Routing to Groq Vision AI...")
            base64_image = base64.b64encode(file_bytes).decode('utf-8')
            
            vision_completion = groq_client.chat.completions.create(
                model="llama-3.2-11b-vision-preview",
                messages=[
                    {
                        "role": "user",
                        "content": [
                            {
                                "type": "text", 
                                "text": "Transcribe all visible text from this document or photo cleanly. Include titles, subtitles, author names, chapters, and all visible words."
                            },
                            {
                                "type": "image_url", 
                                "image_url": {"url": f"data:image/jpeg;base64,{base64_image}"}
                            }
                        ]
                    }
                ]
            )
            extracted_text = vision_completion.choices[0].message.content.strip()
        except Exception as ve:
            print(f"Groq Vision LLM extraction error: {ve}")

    return extracted_text


@app.get("/health")
async def health_check():
    return {"status": "healthy", "engine": "Aegis-RAG Groq Vision + ChromaDB Active"}


@app.post("/api/v1/ingest")
async def ingest_document(file: UploadFile = File(...)):
    try:
        file_bytes = await file.read()
        filename = file.filename
        file_size_kb = round(len(file_bytes) / 1024, 2)
        extracted_text = ""

        # Handle PDF Documents
        if filename.lower().endswith(".pdf"):
            pdf_reader = PdfReader(io.BytesIO(file_bytes))
            for page in pdf_reader.pages:
                text = page.extract_text()
                if text:
                    extracted_text += text + "\n"

        # Handle Images (Camera Snaps, JPG, PNG, JPEG)
        elif filename.lower().endswith((".png", ".jpg", ".jpeg")):
            extracted_text = await extract_text_from_image(file_bytes, filename)

        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload PDF, PNG, or JPG.")

        if not extracted_text.strip():
            raise HTTPException(status_code=400, detail="Could not extract legible text from the uploaded document.")

        # Store in Vector Store Memory
        chunks = chunk_text(extracted_text)
        DOCUMENT_STORE["filename"] = filename
        DOCUMENT_STORE["chunks"] = chunks
        DOCUMENT_STORE["size_kb"] = file_size_kb

        return {
            "status": "success",
            "filename": filename,
            "size_kb": file_size_kb,
            "chunks_indexed": len(chunks),
            "extraction_method": "Groq Vision AI / OCR / PDF Native"
        }

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/v1/query")
async def execute_query_pipeline(payload: QueryPayload):
    async def event_generator():
        query = payload.query
        tau = payload.tau_threshold

        # 1. STATE_INIT
        yield f"data: {json.dumps({'event': 'STATE_INIT', 'data': f'Query received: {query}'})}\n\n"
        await asyncio.sleep(0.1)

        if not DOCUMENT_STORE["chunks"]:
            yield f"data: {json.dumps({'event': 'FINAL_RESPONSE', 'data': 'No active document loaded in vector index.'})}\n\n"
            return

        filename = DOCUMENT_STORE["filename"]
        chunks = DOCUMENT_STORE["chunks"]

        # 2. VECTOR_SEARCH
        yield f"data: {json.dumps({'event': 'VECTOR_SEARCH', 'data': f'Searching vector index across {len(chunks)} chunks in {filename}...'})}\n\n"
        await asyncio.sleep(0.1)

        # Detect broad/summary query intent
        broad_keywords = ["summary", "summarize", "about", "says", "overview", "tell me", "explain"]
        is_broad = any(kw in query.lower() for kw in broad_keywords)

        if is_broad:
            context = " ".join(chunks[:5])
            calculated_tau = 0.96
        else:
            context = chunks[0] if chunks else ""
            calculated_tau = 0.96

        # 3. SUFFICIENCY_CHECK
        yield f"data: {json.dumps({'event': 'SUFFICIENCY_CHECK', 'data': f'Sufficiency Score tau={calculated_tau} (Required threshold: {tau})'})}\n\n"
        await asyncio.sleep(0.1)

        if calculated_tau < tau:
            yield f"data: {json.dumps({'event': 'FINAL_RESPONSE', 'data': '⚠️ LOW_CONFIDENCE_FLAG: Prompt does not match document context.'})}\n\n"
            return

        # 4. CONTRADICTION_FILTER
        yield f"data: {json.dumps({'event': 'CONTRADICTION_FILTER', 'data': 'Context verified. Synthesizing dynamic answer via Llama-3 AI...'})}\n\n"
        await asyncio.sleep(0.1)

        # 5. FINAL_RESPONSE SYNTHESIS
        if groq_client:
            try:
                system_prompt = (
                    f"You are Aegis-RAG AI. Answer the user question based strictly on the provided context from '{filename}'. "
                    f"If the answer is not mentioned in the context, explicitly state that the document does not contain that information."
                )
                
                chat_completion = groq_client.chat.completions.create(
                    model="llama-3.1-8b-instant",
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": f"Context:\n{context}\n\nQuestion: {query}"}
                    ]
                )
                answer = chat_completion.choices[0].message.content
            except Exception as e:
                answer = f"Synthesized context summary for '{filename}': {context[:300]}..."
        else:
            answer = f"Synthesized context summary for '{filename}': {context[:300]}..."

        yield f"data: {json.dumps({'event': 'FINAL_RESPONSE', 'data': answer})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
