import {type LinenAttributes, type Listing, parseLinenAttribute} from '../listings/listing.schemas';
import type {Reservation} from '../reservations/reservation.schemas';
import type {LinenValues} from './linen.types';

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_DAYS_UNTIL_NEXT = 2;

export function calculateLinen(
  listing: Listing,
  plannedStart: Date,
  current: Reservation,
  next: Reservation | undefined,
): LinenValues {
  const attributes = parseLinenAttribute(listing.linen_attribute);
  const nextInWindow = next && isWithinWindow(next.planned_arrival_time, plannedStart) ? next : undefined;
  const plan = nextInWindow
    ? planBeds(attributes, nextInWindow)
    : {sheets: attributes.Beds, prepared: attributes.BedSpots, sofabeds: 0};
  const reservationForGuestDetails = nextInWindow ?? current;
  const bathrooms = countBathrooms(listing.name);

  return {
    sheets: plan.sheets,
    towels: plan.prepared,
    bathmats: bathrooms,
    handtowels: bathrooms !== 0 ? plan.prepared + bathrooms : 0,
    dishtowels: /BR|ST/.test(listing.name) ? 1 : 0,
    prepared_for_guests: plan.prepared,
    requested_sofabeds_count: plan.sofabeds,
    actual_guests: reservationForGuestDetails.guests_count,
    infants: reservationForGuestDetails.infants,
    number_of_guests_override: reservationForGuestDetails.customFields.number_of_guests_override,
    requested_sofabed: reservationForGuestDetails.customFields.requested_sofabed,
  };
}

function planBeds({Beds: B, BedSpots: S, Sofabeds: F, SofaSpots: P}: LinenAttributes, reservation: Reservation) {
  const G = Math.max(reservation.guests_count, reservation.customFields.number_of_guests_override ?? 0);

  if (G <= B) return {sheets: B, prepared: S, sofabeds: 0};
  if (G > S) return {sheets: B + F, prepared: Math.max(G, S + Math.min(F, P)), sofabeds: F};
  if (!reservation.customFields.requested_sofabed) return {sheets: B, prepared: S, sofabeds: 0};
  if (B === 1 && F === 1 && G === 2) return {sheets: 2, prepared: 2, sofabeds: 1};
  if (G >= B + F) return {sheets: B + F, prepared: S + P, sofabeds: F};

  const sofabeds = Math.min(G - B, F);
  return {sheets: G, prepared: S + sofabeds, sofabeds};
}

function isWithinWindow(arrival: Date, plannedStart: Date) {
  const msUntilArrival = arrival.getTime() - plannedStart.getTime();
  return msUntilArrival >= 0 && Math.floor(msUntilArrival / DAY_MS) <= MAX_DAYS_UNTIL_NEXT;
}

function countBathrooms(listingName: string) {
  if (listingName.includes('SS')) return 0;
  return listingName.includes('2BA') ? 2 : 1;
}
