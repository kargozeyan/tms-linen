import eventsJson from '../../../data/events.json' with {type: 'json'};
import {env} from '../config/env';

const EVENTS_URL = `http://localhost:${env.PORT}/events/reservation`;

async function sendEvents() {
  for (const event of eventsJson) {
    const response = await fetch(EVENTS_URL, {
      method: 'POST',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify(event),
    });
    const body = (await response.json()) as {status?: string; error?: string};

    if (!response.ok) {
      throw new Error(`${event.event_id} failed with status ${response.status}: ${body.error}`);
    }

    console.log(`${event.event_id} ${body.status}`);
  }
}

await sendEvents();
