import {describe, expect, it} from 'vitest';
import {createListing, createReservation} from '../../factories';
import {calculateLinen} from '../../../src/modules/linen/linen.calculator';

const PLANNED_START = new Date('2026-03-10T10:00:00Z');
const NEXT_DAY = new Date('2026-03-11T15:00:00Z');

const current = createReservation({guests_count: 2});

function createNext(
  guestsCount: number,
  {
    override = null,
    sofabed = false,
    arrival = NEXT_DAY,
  }: {override?: number | null; sofabed?: boolean; arrival?: Date} = {},
) {
  return createReservation({
    reservation_id: 'R2',
    guests_count: guestsCount,
    planned_arrival_time: arrival,
    customFields: {number_of_guests_override: override, requested_sofabed: sofabed},
  });
}

describe('calculateLinen', () => {
  describe('PDF doc examples', () => {
    const FOUR_SPOTS_ONE_SOFA = {beds: 2, bedSpots: 4, sofabeds: 1, sofaSpots: 2};
    const THREE_DAYS_LATER = new Date('2026-03-13T15:00:00Z');

    it.each([
      {
        task: 'T-G01',
        listing: createListing('2BR-101', FOUR_SPOTS_ONE_SOFA),
        next: undefined,
        expected: {sheets: 2, towels: 4, bathmats: 1, handtowels: 5, dishtowels: 1, requested_sofabeds_count: 0},
      },
      {
        task: 'T-G02',
        listing: createListing('2BR-102', FOUR_SPOTS_ONE_SOFA),
        next: createNext(3, {sofabed: true, arrival: THREE_DAYS_LATER}),
        expected: {sheets: 2, towels: 4, bathmats: 1, handtowels: 5, dishtowels: 1, requested_sofabeds_count: 0},
      },
      {
        task: 'T-G03',
        listing: createListing('2BR-103', FOUR_SPOTS_ONE_SOFA),
        next: createNext(3),
        expected: {sheets: 2, towels: 4, bathmats: 1, handtowels: 5, dishtowels: 1, requested_sofabeds_count: 0},
      },
      {
        task: 'T-G04',
        listing: createListing('2BR-104', FOUR_SPOTS_ONE_SOFA),
        next: createNext(3, {sofabed: true}),
        expected: {sheets: 3, towels: 6, bathmats: 1, handtowels: 7, dishtowels: 1, requested_sofabeds_count: 1},
      },
      {
        task: 'T-G05',
        listing: createListing('2BR-105', FOUR_SPOTS_ONE_SOFA),
        next: createNext(5),
        expected: {sheets: 3, towels: 5, bathmats: 1, handtowels: 6, dishtowels: 1, requested_sofabeds_count: 1},
      },
      {
        task: 'T-G06',
        listing: createListing('2BR-106', FOUR_SPOTS_ONE_SOFA),
        next: createNext(2, {override: 5}),
        expected: {sheets: 3, towels: 5, bathmats: 1, handtowels: 6, dishtowels: 1, requested_sofabeds_count: 1},
      },
      {
        task: 'T-G07',
        listing: createListing('ST-201', {beds: 1, bedSpots: 2, sofabeds: 1, sofaSpots: 1}),
        next: createNext(2, {sofabed: true}),
        expected: {sheets: 2, towels: 2, bathmats: 1, handtowels: 3, dishtowels: 1, requested_sofabeds_count: 1},
      },
      {
        task: 'T-G08',
        listing: createListing('SS-401', {beds: 1, bedSpots: 2, sofabeds: 0, sofaSpots: 0}),
        next: createNext(2),
        expected: {sheets: 1, towels: 2, bathmats: 0, handtowels: 0, dishtowels: 0, requested_sofabeds_count: 0},
      },
      {
        task: 'T-G09',
        listing: createListing('3BR-2BA-301', {beds: 3, bedSpots: 6, sofabeds: 1, sofaSpots: 2}),
        next: createNext(4),
        expected: {sheets: 3, towels: 6, bathmats: 2, handtowels: 8, dishtowels: 1, requested_sofabeds_count: 0},
      },
      {
        task: 'T-G10',
        listing: createListing('2BR-501', {beds: 2, bedSpots: 4, sofabeds: 2, sofaSpots: 4}),
        next: createNext(3, {sofabed: true}),
        expected: {sheets: 3, towels: 5, bathmats: 1, handtowels: 6, dishtowels: 1, requested_sofabeds_count: 1},
      },
    ])('$task', ({listing, next, expected}) => {
      expect(calculateLinen(listing, PLANNED_START, current, next)).toMatchObject(expected);
    });
  });

  describe('2-day window', () => {
    it.each([
      {scenario: 'exactly at planned_start', arrival: '2026-03-10T10:00:00.000Z'},
      {scenario: 'the next day', arrival: '2026-03-11T15:00:00.000Z'},
      {scenario: 'exactly 2 days later', arrival: '2026-03-12T10:00:00.000Z'},
      {scenario: '1 ms before 3 days later', arrival: '2026-03-13T09:59:59.999Z'},
    ])('prepares for the next reservation arriving $scenario', ({arrival}) => {
      const next = createNext(5, {arrival: new Date(arrival)});

      const linen = calculateLinen(createListing(), PLANNED_START, current, next);

      expect(linen.actual_guests).toBe(5);
      expect(linen.sheets).toBe(3);
    });

    it.each([
      {scenario: '1 ms before planned_start', arrival: '2026-03-10T09:59:59.999Z'},
      {scenario: 'exactly 3 days later', arrival: '2026-03-13T10:00:00.000Z'},
      {scenario: 'a week later', arrival: '2026-03-17T10:00:00.000Z'},
    ])('applies the default when the next reservation arrives $scenario', ({arrival}) => {
      const next = createNext(5, {arrival: new Date(arrival)});

      const linen = calculateLinen(createListing(), PLANNED_START, current, next);

      expect(linen.actual_guests).toBe(2);
      expect(linen.sheets).toBe(2);
    });
  });

  describe('default', () => {
    it('uses B, S and no sofabeds when there is no next reservation', () => {
      const linen = calculateLinen(createListing(), PLANNED_START, current, undefined);

      expect(linen).toMatchObject({sheets: 2, prepared_for_guests: 4, requested_sofabeds_count: 0});
    });

    it("ignores the guest count of the task's own reservation", () => {
      const large = createReservation({guests_count: 8, customFields: {requested_sofabed: true}});

      const linen = calculateLinen(createListing(), PLANNED_START, large, undefined);

      expect(linen).toMatchObject({sheets: 2, prepared_for_guests: 4, requested_sofabeds_count: 0});
    });
  });

  describe('bed plan for the next reservation', () => {
    const STUDIO_ONE_SOFA = {beds: 1, bedSpots: 2, sofabeds: 1, sofaSpots: 1};
    const NO_SOFA = {beds: 2, bedSpots: 4, sofabeds: 0, sofaSpots: 0};
    const MANY_SOFAS = {beds: 2, bedSpots: 6, sofabeds: 3, sofaSpots: 6};

    it.each([
      {
        rule: 'G < B',
        beds: {beds: 3, bedSpots: 6},
        next: createNext(2),
        expected: {sheets: 3, prepared_for_guests: 6, requested_sofabeds_count: 0},
      },
      {
        rule: 'G = B',
        beds: {},
        next: createNext(2),
        expected: {sheets: 2, prepared_for_guests: 4, requested_sofabeds_count: 0},
      },
      {
        rule: 'G <= B ignores a sofabed request',
        beds: {},
        next: createNext(2, {sofabed: true}),
        expected: {sheets: 2, prepared_for_guests: 4, requested_sofabeds_count: 0},
      },
      {
        rule: 'G = B with a sofabed request does not add unused sofa spots',
        beds: {beds: 2, bedSpots: 4, sofabeds: 0, sofaSpots: 2},
        next: createNext(2, {sofabed: true}),
        expected: {sheets: 2, prepared_for_guests: 4, requested_sofabeds_count: 0},
      },
      {
        rule: 'B < G < S without a sofabed request',
        beds: {},
        next: createNext(3),
        expected: {sheets: 2, prepared_for_guests: 4, requested_sofabeds_count: 0},
      },
      {
        rule: 'G = S without a sofabed request',
        beds: {},
        next: createNext(4),
        expected: {sheets: 2, prepared_for_guests: 4, requested_sofabeds_count: 0},
      },
      {
        rule: 'B=1, F=1, G=2 with a sofabed request',
        beds: STUDIO_ONE_SOFA,
        next: createNext(2, {sofabed: true}),
        expected: {sheets: 2, prepared_for_guests: 2, requested_sofabeds_count: 1},
      },
      {
        rule: 'B=1, F=1, G=2 without a sofabed request',
        beds: STUDIO_ONE_SOFA,
        next: createNext(2),
        expected: {sheets: 1, prepared_for_guests: 2, requested_sofabeds_count: 0},
      },
      {
        rule: 'G = B+F with a sofabed request',
        beds: {},
        next: createNext(3, {sofabed: true}),
        expected: {sheets: 3, prepared_for_guests: 6, requested_sofabeds_count: 1},
      },
      {
        rule: 'G > B+F with a sofabed request',
        beds: {},
        next: createNext(4, {sofabed: true}),
        expected: {sheets: 3, prepared_for_guests: 6, requested_sofabeds_count: 1},
      },
      {
        rule: 'a sofabed request on a listing with no sofabeds',
        beds: NO_SOFA,
        next: createNext(3, {sofabed: true}),
        expected: {sheets: 2, prepared_for_guests: 4, requested_sofabeds_count: 0},
      },
      {
        rule: 'all other sofabed cases, one sofa needed',
        beds: MANY_SOFAS,
        next: createNext(3, {sofabed: true}),
        expected: {sheets: 3, prepared_for_guests: 7, requested_sofabeds_count: 1},
      },
      {
        rule: 'all other sofabed cases, two sofas needed',
        beds: MANY_SOFAS,
        next: createNext(4, {sofabed: true}),
        expected: {sheets: 4, prepared_for_guests: 8, requested_sofabeds_count: 2},
      },
      {
        rule: 'G > S with spare sofa spots',
        beds: {},
        next: createNext(5),
        expected: {sheets: 3, prepared_for_guests: 5, requested_sofabeds_count: 1},
      },
      {
        rule: 'G > S beyond the sofa spots',
        beds: {},
        next: createNext(8),
        expected: {sheets: 3, prepared_for_guests: 8, requested_sofabeds_count: 1},
      },
      {
        rule: 'G > S limits sofa spots with min(F, P)',
        beds: {beds: 2, bedSpots: 4, sofabeds: 2, sofaSpots: 1},
        next: createNext(5),
        expected: {sheets: 4, prepared_for_guests: 5, requested_sofabeds_count: 2},
      },
      {
        rule: 'G > S without a sofabed request still uses the sofas',
        beds: {},
        next: createNext(6),
        expected: {sheets: 3, prepared_for_guests: 6, requested_sofabeds_count: 1},
      },
      {
        rule: 'G > S with a sofabed request',
        beds: {},
        next: createNext(6, {sofabed: true}),
        expected: {sheets: 3, prepared_for_guests: 6, requested_sofabeds_count: 1},
      },
      {
        rule: 'G > S on a listing with no sofabeds',
        beds: NO_SOFA,
        next: createNext(5),
        expected: {sheets: 2, prepared_for_guests: 5, requested_sofabeds_count: 0},
      },
    ])('$rule', ({beds, next, expected}) => {
      const linen = calculateLinen(createListing('2BR-101', beds), PLANNED_START, current, next);

      expect(linen).toMatchObject(expected);
    });
  });

  describe('G', () => {
    it.each([
      {scenario: 'override above guests_count', guests: 2, override: 5, expectedSheets: 3},
      {scenario: 'override below guests_count', guests: 5, override: 2, expectedSheets: 3},
      {scenario: 'override of 0', guests: 5, override: 0, expectedSheets: 3},
      {scenario: 'no override', guests: 2, override: null, expectedSheets: 2},
    ])('uses the larger value with $scenario', ({guests, override, expectedSheets}) => {
      const next = createNext(guests, {override});

      const linen = calculateLinen(createListing(), PLANNED_START, current, next);

      expect(linen.sheets).toBe(expectedSheets);
    });

    it('does not add infants, which are already in guests_count', () => {
      const next = createReservation({guests_count: 2, infants: 3, planned_arrival_time: NEXT_DAY});

      const linen = calculateLinen(createListing(), PLANNED_START, current, next);

      expect(linen.sheets).toBe(2);
    });
  });

  describe('towels', () => {
    it('match prepared_for_guests', () => {
      const linen = calculateLinen(createListing(), PLANNED_START, current, createNext(8));

      expect(linen.towels).toBe(8);
      expect(linen.prepared_for_guests).toBe(8);
    });
  });

  describe('bathmats and handtowels', () => {
    it.each([
      {scenario: 'contains SS', name: 'SS-401', bathmats: 0, handtowels: 0},
      {scenario: 'contains 2BA', name: '3BR-2BA-301', bathmats: 2, handtowels: 6},
      {scenario: 'contains neither', name: '2BR-101', bathmats: 1, handtowels: 5},
      {scenario: 'contains both SS and 2BA', name: 'SS-2BA', bathmats: 0, handtowels: 0},
    ])('when the name $scenario', ({name, bathmats, handtowels}) => {
      const linen = calculateLinen(createListing(name), PLANNED_START, current, undefined);

      expect(linen).toMatchObject({bathmats, handtowels});
    });

    it('adds the bathrooms to the prepared guests for handtowels', () => {
      const linen = calculateLinen(createListing('3BR-2BA-301'), PLANNED_START, current, createNext(8));

      expect(linen.handtowels).toBe(10);
    });
  });

  describe('dishtowels', () => {
    it.each([
      {name: '2BR-101', dishtowels: 1},
      {name: 'ST-201', dishtowels: 1},
      {name: 'SS-401', dishtowels: 0},
      {name: 'APT-1', dishtowels: 0},
    ])('$name has $dishtowels', ({name, dishtowels}) => {
      const linen = calculateLinen(createListing(name), PLANNED_START, current, undefined);

      expect(linen.dishtowels).toBe(dishtowels);
    });
  });

  describe('guest details', () => {
    const own = createReservation({
      guests_count: 2,
      infants: 1,
      customFields: {number_of_guests_override: 3, requested_sofabed: true},
    });
    const next = createReservation({
      guests_count: 4,
      infants: 2,
      planned_arrival_time: NEXT_DAY,
      customFields: {number_of_guests_override: 5, requested_sofabed: false},
    });
    const ownDetails = {actual_guests: 2, infants: 1, number_of_guests_override: 3, requested_sofabed: true};
    const nextDetails = {actual_guests: 4, infants: 2, number_of_guests_override: 5, requested_sofabed: false};

    it('come from the next reservation inside the window', () => {
      const linen = calculateLinen(createListing(), PLANNED_START, own, next);

      expect(linen).toMatchObject(nextDetails);
    });

    it("come from the task's own reservation when there is no next one", () => {
      const linen = calculateLinen(createListing(), PLANNED_START, own, undefined);

      expect(linen).toMatchObject(ownDetails);
    });

    it("come from the task's own reservation when the next one is outside the window", () => {
      const lateNext = {...next, planned_arrival_time: new Date('2026-03-20T15:00:00Z')};

      const linen = calculateLinen(createListing(), PLANNED_START, own, lateNext);

      expect(linen).toMatchObject(ownDetails);
    });
  });
});
