import 'dotenv/config'; 
import path from 'path';

import { loadPdf } from './loader/pdf_loader.js'; 
import { createChunks } from './src/utils/chunker.js';
import { indexChunk } from './src/services/vector_service.js';
import { generateEmbedding } from './src/services/llm_service.js';

const DOCUMENT_FILE = 'amazon.pdf';
const DOCUMENT_PATH = path.join(process.cwd(), DOCUMENT_FILE);

const extractTextAndMetadata = async () => {
    console.log(`Reading document: ${DOCUMENT_FILE}`);
    
    const { rawText, totalPages } = await loadPdf(DOCUMENT_PATH);
    
    return {
        rawText: rawText.text,
        totalPages: totalPages, 
        fileName: DOCUMENT_FILE
    };
};

const runIngestionPipeline = async () => {
    try {
        console.log("--- STARTING RAG INGESTION PIPELINE ---");
        
        const { rawText, totalPages, fileName } = await extractTextAndMetadata();
        
        console.log(`\n2. Chunking ${rawText.length} characters across ${totalPages} pages...`);
        
        const chunksToEmbed = createChunks(rawText, fileName, totalPages);
        console.log(`chunksToEmbed: ${chunksToEmbed}\n\n\n`);
        console.log(`   -> Created ${chunksToEmbed.length} chunks.`);

        console.log("\n3. Generating embeddings and indexing chunks concurrently...");

        const indexingPromises = chunksToEmbed.map(async (chunk) => {
            const vector = await generateEmbedding(chunk.text);
            await indexChunk(chunk.text, vector, chunk.metadata);
        });

        await Promise.all(indexingPromises);

        console.log("\n✅ SUCCESS: ALL CHUNKS INDEXED SUCCESSFULLY.");

    } catch (error) {
        console.error("\n❌ CRITICAL INGESTION FAILURE:", error.message);
        console.error("Troubleshooting: Ensure the PDF file is in the project root and readable.");
    }
};

runIngestionPipeline();
