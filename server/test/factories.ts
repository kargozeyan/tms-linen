import type {LinenValues, TaskLinen} from '../src/modules/linen/linen.types';
import type {Listing} from '../src/modules/listings/listing.schemas';
import type {Reservation} from '../src/modules/reservations/reservation.schemas';
import {MAIN_CLEANING, type Task} from '../src/modules/tasks/task.schemas';

type BedCounts = {beds: number; bedSpots: number; sofabeds: number; sofaSpots: number};

type ReservationOverrides = Partial<Omit<Reservation, 'customFields'>> & {
  customFields?: Partial<Reservation['customFields']>;
};

const STANDARD_BEDS: BedCounts = {beds: 2, bedSpots: 4, sofabeds: 1, sofaSpots: 2};

export function createListing(name = '2BR-101', bedCounts: Partial<BedCounts> = {}): Listing {
  const {beds, bedSpots, sofabeds, sofaSpots} = {...STANDARD_BEDS, ...bedCounts};

  return {
    listing_id: 'L1',
    name,
    linen_attribute: `G:6;Beds:${beds};BedSpots:${bedSpots};Sofabeds:${sofabeds};SofaSpots:${sofaSpots}`,
  };
}

export function createReservation({customFields, ...overrides}: ReservationOverrides = {}): Reservation {
  return {
    reservation_id: 'R1',
    listing_id: 'L1',
    status: 'Confirmed',
    planned_arrival_time: new Date('2026-03-05T15:00:00Z'),
    planned_departure_time: new Date('2026-03-10T10:00:00Z'),
    guests_count: 2,
    infants: 0,
    ...overrides,
    customFields: {number_of_guests_override: null, requested_sofabed: false, ...customFields},
  };
}

export function createTask(overrides: Partial<Task> = {}): Task {
  return {
    task_id: 'T1',
    task_type: MAIN_CLEANING,
    status: 'Pending',
    listing_id: 'L1',
    reservation_id: 'R1',
    planned_start: new Date('2026-03-10T10:00:00Z'),
    ...overrides,
  };
}

export function createLinenValues(overrides: Partial<LinenValues> = {}): LinenValues {
  return {
    sheets: 2,
    towels: 4,
    bathmats: 1,
    handtowels: 5,
    dishtowels: 1,
    prepared_for_guests: 4,
    requested_sofabeds_count: 0,
    actual_guests: 2,
    infants: 0,
    number_of_guests_override: null,
    requested_sofabed: false,
    ...overrides,
  };
}

export function createTaskLinen(overrides: Partial<TaskLinen> = {}): TaskLinen {
  return {task_id: 'T1', ...createLinenValues(), ...overrides};
}
