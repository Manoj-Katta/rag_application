# rag_application
# BrowserStack RAG System Assignment 
- This project implements a Retrieval-Augmented Generation (RAG) pipeline designed to accurately answer questions over internal documents. 
- The system uses a Two-Stage Retrieval mechanism for high precision and is built using Node.js, PostgreSQL/PGVector, and external LLM services.
## 🛠️ Technical Stack
|Component | Technology |
| :--- | :---: |
| **Backend Framework** | **Node.js (Express)** | 
| **Vector Database** | **PostgreSQL + PGVector** | 
| **Embedding Model** | **Gemini Embedding** |
| **Reranking Model** | **Cohere Rerank** | 
| **Final LLM** | **Gemini 2.5 Flash** | 


## Setup and Installation
### Prerequisites
- Node.js
- PostgreSQL
- PGVector Extension: The vector extension must be enabled in your target database (rag_db).

1. Database Configuration
Connect to your PostgreSQL server (using psql or pgAdmin) and run the following commands:
SQL-- 
```
CREATE DATABASE rag_db;
```

2. Connect to the new database
```
\c rag_db
```

3. Enable the PGVector extension
```
CREATE EXTENSION vector;
```

4. Create the final RAG table schema (embedding uses 768 dimensions)
```
CREATE TABLE chunks (
    id SERIAL PRIMARY KEY,
    text_chunk TEXT NOT NULL,
    embedding vector(768), 
    metadata JSONB
);
```
2. Project Setup
Clone the repository and install dependencies:
```
npm install
```
- Create a file named .env in the project root and add your credentials: 
    
    DB_USER=postgres

    DATABASE=rag_db

    PASSWORD=mysecretpassword 

    DB_PORT=5432

    GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE

    COHERE_API_KEY=YOUR_COHERE_API_KEY_HERE 

3. Running the System

Step 1: Data Ingestion (Indexing)
- Run the ingestion script once to process the PDF, generate embeddings, and populate PGVector.
```
node ingestion.js
```
Step 2: Start the API Server
```
node index.js
```
The server will start on http://localhost:3000.

Step 3: Query the RAG Pipeline
- Use curl or Postman to send a question to the main endpoint.Example Query:
```
curl -X POST http://localhost:3000/answer \
     -H "Content-Type: application/json" \
     -d '{"query": "What was Amazon'\''s total revenue in 2023, and what was the YoY growth?"}'
```

## RAG Pipeline Architecture 
The system follows a strict two-stage retrieval process:
1. High Recall (PGVector): The user query is embedded and sent to PGVector, using the Cosine Distance operator (<=>) to retrieve the top 20 candidate chunks. This casting of a wide net maximizes the chance of finding the correct answer.

2. High Precision (Cohere Rerank): The top 20 candidates are sent to the Cohere Cross-Encoder. This model analyzes the query and the document text together to produce a high-precision Relevance Score.
Grounded Generation: Only the top 4 most relevant chunks are sent to Gemini 2.5 Flash. The final LLM prompt includes a STRICT GROUNDING CONSTRAINT instructing the model to "MUST use ONLY the facts provided in the CONTEXT" and avoid hallucination.This architecture ensures the final answer is both fast and factually accurate.