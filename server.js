import express from 'express';
import bodyParser from 'body-parser';
import twilio from 'twilio';
import process from 'process';
import 'dotenv';
import { describeImage, storeImage } from './handleImages.js';
import { chat, addToChatHistory } from './chat.js';

const app = express();
const port = 3000;

app.use(express.json());
app.use(bodyParser.urlencoded({ extended: false }));

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const twilioClient = twilio(accountSid, authToken);

function splitMessage(text) {
  const maxLength = 1600;
  const parts = [];
  let start = 0;

  while (start < text.length) {
    let end = start + maxLength;

    if (end > text.length) {
      end = text.length;
    } else {
      const lastSpace = text.lastIndexOf('\n', end);
      if (lastSpace > start) {
        end = lastSpace;
      }
    }

    parts.push(text.slice(start, end).trim());
    start = end;
  }

  return parts;
}

async function sendMessage(message, from, to) {
  if (message.length > 1600) {
    const parts = splitMessage(message)
    for (let i = 0; i < parts.length; i++) {
      console.log('part', parts[i].length)
      await twilioClient.messages
        .create({ body: parts[i], from: from, to: to })
        .then((msg) => console.log(msg.sid));
    }
  } else {
    twilioClient.messages
      .create({ body: message, from: from, to: to })
      .then((msg) => console.log(msg.sid));
  }
}


app.post('/incomingMessage', async (req, res) => {
  const { To, Body, From } = req.body;
  const mediaURL = req.body['MediaUrl0'];

  if (mediaURL !== undefined) {
    const imagePath = await storeImage(mediaURL);
    const imageDescription = await describeImage(imagePath);
    addToChatHistory(
      { 'role': 'user', 'content': 'Describe the image with details, listing every visible item' },
      { 'role': 'assistant', 'content': imageDescription }
    );

    const message = imageDescription;
    await sendMessage(message, To, From);
    res.set('Content-Type', 'text/xml');
    res.send('').status(200);
  } else {
    const message = await chat(Body);
    await sendMessage(message, To, From);
    res.set('Content-Type', 'text/xml');
    res.send('').status(200);
  }
});


app.listen(port, () => {
  console.log(`Express server running on port ${port}`);
});
