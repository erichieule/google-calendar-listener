import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import {google} from 'googleapis';
import path from 'path';
import fs from 'fs/promises';
import {v4} from 'uuid';
import localtunnel from 'localtunnel';

const app = express();
const port = 4040;

dotenv.config();
app.use(express.json());
app.use(cors());
app.options('*', cors());

// If modifying these scopes, delete token.json.
const SCOPES = ['https://www.googleapis.com/auth/calendar.readonly'];
// The file token.json stores the user's access and refresh tokens, and is
// created automatically when the authorization flow completes for the first
// time.
const TOKEN_PATH = path.join(process.cwd(), 'token.json');
const CALENDAR_ID = 'c_188398mh0rpsgir0lo9pqpvl9hciq@resource.calendar.google.com';

/**
 * Reads previously authorized credentials from the save file.
 *
 * @return {Promise<OAuth2Client|null>}
 */
async function loadSavedCredentialsIfExist() {
  try {
    const content = await fs.readFile(TOKEN_PATH);
    const credentials = JSON.parse(content);
    return google.auth.fromJSON(credentials);
  } catch (err) {
    return null;
  }
}

/**
 * Load or request or authorization to call APIs.
 *
 */
async function authorize() {
  return await loadSavedCredentialsIfExist();
}

app.post('/gg-cal-webhook', async (req, res) => {
  const resourceId = req.headers['x-goog-resource-id'];
  const channelToken = req.headers['x-goog-channel-token'];
  const channelId = req.headers['x-goog-channel-id'];
  const resourceState = req.headers['x-goog-resource-state'];

  // Use the channel token to validate the webhook

  if (resourceState === 'sync') {
    return res.status(200).send();
  }

  // Authorization details for google API are explained in previous steps.
  const calendar = google.calendar({version: 'v3'});
  // Get the events that changed during the webhook timestamp by using timeMin property.
  const event = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: new Date().toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });
  // log in the console the total events that changed since the webhook was called.
  console.info(event.data.items);

  return res.status(200).send('Webhook received');
});

app.get('/upcoming-events', async (req, res) => {
  const calendar = google.calendar({version: 'v3'});
  const response = await calendar.events.list({
    calendarId: CALENDAR_ID,
    timeMin: new Date().toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });
  const events = response.data.items;
  res.json(events);
});

app.get('/', (req, res) => {
  res.send('Hello World!');
});

const initWatchEvents = async (address) => {
  const calendar = google.calendar({version: 'v3'});
  const response = await calendar.events.watch({
    calendarId: CALENDAR_ID,
    requestBody: {
      id: v4(),
      type: 'web_hook',
      address,
    },
  });
  console.log(response.data);
};

app.listen(port, async () => {
  const auth = await authorize();
  if (auth) {
    google.options({auth});
  }

  const tunnel = await localtunnel({
    port,
  });
  const calendar = google.calendar({version: 'v3'});
  const response = await calendar.events.watch({
    calendarId: CALENDAR_ID,
    requestBody: {
      id: v4(),
      type: 'web_hook',
      address: tunnel.url + '/gg-cal-webhook',
    },
  });
  console.log(response.data);

  console.log(`Listening on port ${port}...`);
});
