import { Ollama } from 'ollama';
import * as fs from 'fs';
import fetch from 'node-fetch';
import process from 'process';
import 'dotenv/config';

const ollamaBaseURL = process.env.OLLAMA_BASE_URL;
const ollama = new Ollama({ host: ollamaBaseURL, fetch: fetch });
const imagePath = './images/image.jpg';

export async function storeImage(mediaURL) {
  return new Promise((resolve) => {
    fetch(mediaURL)
      .then(async (res) => {
        res.body.pipe(fs.createWriteStream(imagePath));
        res.body.on('end', () => resolve(imagePath));
      }).catch((error) => {
        console.error(error);
        resolve(undefined);
      });
  });
}

export async function describeImage() {
  try {
    const prompt = 'Provide a detailed description of the image, enumerating each visible element.';
    const imageData = fs.readFileSync(imagePath).toString('base64');

    const response = await ollama.chat({
      model: 'llava',
      messages: [{ role: 'user', content: prompt, images: [imageData] }],
    });
    return response.message.content;
  } catch (error) {
    return 'Failed to use the Vision model to answer your message'
  }
}

async function test() {
  const response = await describeImage();
  console.log(`image description: ${response}`);
}

// test()
