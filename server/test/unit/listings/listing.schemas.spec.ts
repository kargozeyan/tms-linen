import {describe, expect, it} from 'vitest';
import {listingSchema, parseLinenAttribute} from '../../../src/modules/listings/listing.schemas';

const VALID_ATTRIBUTE = 'G:6;Beds:2;BedSpots:4;Sofabeds:1;SofaSpots:2';
const validListing = {listing_id: 'L1', name: '2BR-101', linen_attribute: VALID_ATTRIBUTE};

describe('parseLinenAttribute', () => {
  it('parses every value as a number', () => {
    expect(parseLinenAttribute(VALID_ATTRIBUTE)).toEqual({G: 6, Beds: 2, BedSpots: 4, Sofabeds: 1, SofaSpots: 2});
  });
});

describe('listingSchema', () => {
  it('accepts a valid listing', () => {
    expect(listingSchema.parse(validListing)).toEqual(validListing);
  });

  it('accepts an attribute without the unused G value', () => {
    const listing = {...validListing, linen_attribute: 'Beds:2;BedSpots:4;Sofabeds:1;SofaSpots:2'};

    expect(listingSchema.safeParse(listing).success).toBe(true);
  });

  it('accepts a bed count of 0', () => {
    const listing = {...validListing, linen_attribute: 'Beds:1;BedSpots:2;Sofabeds:0;SofaSpots:0'};

    expect(listingSchema.safeParse(listing).success).toBe(true);
  });

  it.each([
    {scenario: 'an empty listing_id', listing: {...validListing, listing_id: ''}},
    {scenario: 'an empty name', listing: {...validListing, name: ''}},
    {scenario: 'a missing linen_attribute', listing: {listing_id: 'L1', name: '2BR-101'}},
    {scenario: 'an empty linen_attribute', listing: {...validListing, linen_attribute: ''}},
  ])('rejects $scenario', ({listing}) => {
    expect(listingSchema.safeParse(listing).success).toBe(false);
  });

  it.each(['Beds', 'BedSpots', 'Sofabeds', 'SofaSpots'])('rejects an attribute missing %s', (key) => {
    const attribute = VALID_ATTRIBUTE.split(';')
      .filter((pair) => !pair.startsWith(`${key}:`))
      .join(';');

    expect(listingSchema.safeParse({...validListing, linen_attribute: attribute}).success).toBe(false);
  });

  it.each(['two', '', '-1', '1.5'])('rejects a bed count of "%s"', (beds) => {
    const attribute = `G:6;Beds:${beds};BedSpots:4;Sofabeds:1;SofaSpots:2`;

    expect(listingSchema.safeParse({...validListing, linen_attribute: attribute}).success).toBe(false);
  });
});
