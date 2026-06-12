/**
 * postcode.ts — UK postcode normalisation and comparison.
 *
 * Normalises postcodes to upper-case with all whitespace stripped so that
 * "DE1 1AA", "de11aa", "De1  1aa" etc. all compare as equal.
 *
 * PITFALLS.md: UK postcodes may come from the API with a space (e.g. "SW1A 1AA")
 * or without ("SW1A1AA") — the postcode gate in the tracking service must treat
 * these as equivalent.
 */

/**
 * Normalise a postcode to upper-case with all whitespace removed.
 * e.g. "de1 1aa" -> "DE11AA", " SW1A 2AA " -> "SW1A2AA"
 */
export function normalisePostcode(value: string): string {
  return value.toUpperCase().replace(/\s+/g, '');
}

/**
 * Compare two postcodes in a format-insensitive way.
 *
 * Returns false if either normalised value is empty (guards against
 * empty-string supplied postcodes matching anything).
 *
 * @param supplied  Postcode entered by the user (may have spaces/mixed case)
 * @param fromApi   Postcode from the Nexus API `delAddressPostcode` field
 */
export function postcodesMatch(supplied: string, fromApi: string): boolean {
  const normSupplied = normalisePostcode(supplied);
  const normFromApi = normalisePostcode(fromApi);
  if (!normSupplied || !normFromApi) {
    return false;
  }
  return normSupplied === normFromApi;
}
