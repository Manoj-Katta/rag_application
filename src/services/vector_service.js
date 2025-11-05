import pg from 'pg';
import { registerTypes, toSql } from 'pgvector/pg'; 
import * as pgvector from 'pgvector'
const { Pool } = pg;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DATABASE,
    password: process.env.PASSWORD, 
    port: parseInt(process.env.DB_PORT),
});

pool.on('connect', async (client) => {
    try {
        await registerTypes(client); 
        console.log("PGVector types registered successfully.");
    } catch (err) {
        console.error("Failed to register PGVector types:", err.message);
        throw err;
    }
});

const indexChunk = async (textChunk, vector, metadata) => {
    const vectorSql = pgvector.toSql(vector);
    
    const insertQuery = `
        INSERT INTO chunks (text_chunk, embedding, metadata)
        VALUES ($1, $2, $3);
    `;
    
    const values = [textChunk, vectorSql, metadata]; 

    try {
        const result = await pool.query(insertQuery, values);
        return result.rowCount; 
    } catch (error) {
        console.error("Error indexing chunk:", error.message);
        throw error;
    }
};

const searchChunks = async (queryVector, k) => {
    const queryVectorSql = pgvector.toSql(queryVector);

    const searchQuery = `
        SELECT 
            id, 
            text_chunk, 
            metadata, 
            embedding <=> $1 AS distance
        FROM 
            chunks
        ORDER BY 
            distance
        LIMIT $2;
    `;
    
    const values = [queryVectorSql, k]; 

    try {
        const res = await pool.query(searchQuery, values);
        return res.rows; 
    } catch (error) {
        console.error("Error searching chunks:", error.message);
        throw error;
    }
};

export {
    indexChunk,
    searchChunks,
};