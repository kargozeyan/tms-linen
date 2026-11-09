import eventsJson from '../../../../data/events.json' with {type: 'json'};
import type {LinenValues} from '../../../src/modules/linen/linen.types';

export function findEvent(eventId: string) {
  const event = eventsJson.find(({event_id}) => event_id === eventId);
  if (!event) {
    throw new Error(`Event ${eventId} is not in events.json`);
  }

  return event;
}

export function toQuantities(linen: LinenValues) {
  const {sheets, towels, bathmats, handtowels, dishtowels, requested_sofabeds_count: sofabeds} = linen;

  return {sheets, towels, bathmats, handtowels, dishtowels, sofabeds};
}
