const createChunks = (rawText, fileName, totalPages) => {
    const CHUNK_SIZE = 1024;
    const CHUNK_OVERLAP = 200;

    const chunks = [];
    let currentPosition = 0;
    let chunkId = 1;
    
    const ESTIMATED_CHARS_PER_PAGE = rawText.length / totalPages;
    while (currentPosition < rawText.length) {
        const chunkStart = currentPosition;
        const chunkEnd = Math.min(currentPosition + CHUNK_SIZE, rawText.length);

        const chunkContent = rawText.substring(chunkStart, chunkEnd);
        
        const pageEstimate = Math.floor(chunkStart / ESTIMATED_CHARS_PER_PAGE) + 1;

        chunks.push({
            text: chunkContent,
            metadata: {
                file_name: fileName,
                page_number: Math.min(pageEstimate, totalPages), 
                chunk_id: `chunk_${chunkId}`
            }
        });

        if (chunkEnd === rawText.length) break;

        currentPosition = chunkEnd - CHUNK_OVERLAP;
        chunkId++;
    }

    return chunks;
};

export {
    createChunks
};
