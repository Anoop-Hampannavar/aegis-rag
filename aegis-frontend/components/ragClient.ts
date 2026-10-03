export interface RAGQueryRequest {
  query: string;
  topK?: number;
  collectionName?: string;
}

export interface RetrievedDocument {
  docId: string;
  content: string;
  similarityScore: number;
  metadata?: Record<string, any>;
}

export interface RAGResponse {
  answer: string;
  sources: RetrievedDocument[];
  retrievalLatencyMs: number;
  confidenceScore: number;
}

export class AegisRAGClient {
  private baseUrl: string;

  constructor(baseUrl: string = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  async queryKnowledgeBase(payload: RAGQueryRequest): Promise<RAGResponse> {
    const res = await fetch(`${this.baseUrl}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`RAG Query failed with status: ${res.status}`);
    }

    return (await res.json()) as RAGResponse;
  }
}
