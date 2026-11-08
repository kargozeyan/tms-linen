import {z} from 'zod';
import {count, nonEmptyString} from '../../shared/schemas';

const REQUIRED_LINEN_KEYS = ['Beds', 'BedSpots', 'Sofabeds', 'SofaSpots'] as const;

export type LinenAttributes = Record<(typeof REQUIRED_LINEN_KEYS)[number], number>;

export const listingSchema = z.object({
  listing_id: nonEmptyString,
  name: nonEmptyString,
  linen_attribute: z.string().refine(hasRequiredLinenValues, {
    message: `Must contain integer values for ${REQUIRED_LINEN_KEYS.join(', ')}`,
  }),
});

export type Listing = z.output<typeof listingSchema>;

export function parseLinenAttribute(attribute: string) {
  const entries = attribute.split(';').map((pair): [string, number] => {
    const [key = '', value] = pair.split(':');
    return [key, Number(value || NaN)];
  });
  return Object.fromEntries(entries) as LinenAttributes;
}

function hasRequiredLinenValues(attribute: string) {
  const attributes = parseLinenAttribute(attribute);
  return REQUIRED_LINEN_KEYS.every((key) => count.safeParse(attributes[key]).success);
}
