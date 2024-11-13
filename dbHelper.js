import { Ollama } from 'ollama';
import { ChromaClient } from 'chromadb';
import fs from 'fs';
import fetch from 'cross-fetch';
import process from 'process';
import 'dotenv/config';

const ollamaBaseURL = process.env.OLLAMA_BASE_URL;
const ollama = new Ollama({ host: ollamaBaseURL, fetch: fetch });

const chroma = new ChromaClient({ path: 'http://localhost:8000' });
const collection = await chroma.getOrCreateCollection({ name: 'recipes', metadata: { 'hnsw:space': 'cosine' } });


async function splitIntoChunks(fileName) {
  let content = fs.readFileSync(fileName, { encoding: 'utf-8' });
  const chunks = content.split('--+--');
  chunks.splice((chunks.length - 1), 1);
  return chunks;
}

async function generateEmbeddings(chunks) {
  const response = await ollama.embed({ model: 'nomic-embed-text', input: chunks });
  return response.embeddings;
}

async function createEmbeddings() {
  let fileName = 'recipes.txt';
  const chunks = await splitIntoChunks(fileName)
  const chunkIdentifiers = [];

  for (let i = 0; i < chunks.length; i++) {
    chunkIdentifiers.push(`${fileName}-${i}`);
  }
  const metadatas = Array(chunks.length).fill({ source: fileName });
  const embeddings = await generateEmbeddings(chunks);
  console.log('embeddings', embeddings.length);

  await collection.add({ ids: chunkIdentifiers, embeddings: embeddings, documents: chunks, metadatas: metadatas });
}


export async function retrieveRecipes(args) {
  const query = args.RAGQuery;
  const numberOfRecipes = args.numberOfRecipes !== undefined ? args.numberOfRecipes : 3
  const queryEmbedding = (await ollama.embed({ model: 'nomic-embed-text', input: query })).embeddings[0];
  const docsFound = await collection.query({ queryEmbeddings: [queryEmbedding], nResults: numberOfRecipes });
  return docsFound;
}


async function test() {
  // await createEmbeddings();
  // console.log('created embeddings')

  const args = {
    RAGQuery: 'Suggest two recipes with cheese',
    numberOfRecipes: 2,
  }

  const recipes = await retrieveRecipes(args);
  console.log(`recipes found: ${recipes.documents}`);
}

// test();
