import { Ollama } from 'ollama';
import fetch from 'cross-fetch';
import { retrieveRecipes } from './dbHelper.js';
import process from 'process';
import 'dotenv/config';

const ollamaBaseURL = process.env.OLLAMA_BASE_URL;
const ollama = new Ollama({ host: ollamaBaseURL, fetch: fetch });

const messages = [];
const retrievalTool = {
  type: 'function',
  function: {
    name: 'retrieve_recipes',
    description: 'Given an ingredient or ingredients names retrieve recipes',
    parameters: {
      type: 'object',
      properties: {
        RAGQuery: {
          type: 'string',
          description: 'The ingredient or ingredients names',
        },
        numberOfRecipes: {
          type: 'number',
          description: 'The number of recipes',
        }
      },
      required: ['RAGQuery'],
    },
  },
};

export function addToChatHistory(message) {
  messages.push(message);
}

export async function chat(query) {
  try {
    const model = 'mistral-nemo';
    const initialPrompt = `You are an assistant that, given the following user query, returns a string. If the user is looking for a recipe by name or ingredient, return the appropriate query. If the user is not trying to find a recipe, answer the query directly. 
    Query: ${query}`;
    addToChatHistory({ 'role': 'user', 'content': initialPrompt });

    const response = await ollama.chat({
      model: model,
      messages: messages,
      tools: [retrievalTool],
    });

    if (!response.message.tool_calls || response.message.tool_calls.length === 0) {
      console.log('The model didn\'t use the function. Its response was:');
      return response.message.content;
    }

    let recipes;
    if (response.message.tool_calls) {
      const availableFunctions = {
        retrieve_recipes: retrieveRecipes,
      };
      for (const tool of response.message.tool_calls) {
        const functionToCall = availableFunctions[tool.function.name];
        const functionResponse = await functionToCall(tool.function.arguments);
        recipes = functionResponse.documents[0].join('\n\n');
        console.log('function response', functionResponse.documents);
      }
    }

    const RAGPrompt = `You are an assistant for question-answering tasks. Using only the provided context, answer the query. If you don't know the answer, simply say that you don't know. 
    Query: ${query}
    Context: ${recipes}`;


    addToChatHistory({ 'role': 'user', 'content': RAGPrompt });

    const finalResponse = await ollama.chat({
      model: model,
      messages: messages,
    });

    addToChatHistory({ 'role': 'assistant', 'content': finalResponse.message.content });
    return finalResponse.message.content;

  } catch (error) {
    console.error(error)
    return 'Failed to use an LLM to answer your message'
  }
}


async function test() {
  let query = 'Suggest 2 recipes with tomatoes';
  let response = await chat(query);
  console.log(`query: ${query}`, `response : ${response}`);

  query = 'Tell me more about the first recipe';
  response = await chat(query);
  console.log(`query: ${query}`, `response : ${response}`);
}

// test();
