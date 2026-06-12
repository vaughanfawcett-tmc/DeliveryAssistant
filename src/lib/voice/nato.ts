/**
 * ICAO/NATO phonetic alphabet map.
 * Keys are uppercase letters A-Z.
 */
export const NATO: Record<string, string> = {
  A: 'Alfa',
  B: 'Bravo',
  C: 'Charlie',
  D: 'Delta',
  E: 'Echo',
  F: 'Foxtrot',
  G: 'Golf',
  H: 'Hotel',
  I: 'India',
  J: 'Juliett',
  K: 'Kilo',
  L: 'Lima',
  M: 'Mike',
  N: 'November',
  O: 'Oscar',
  P: 'Papa',
  Q: 'Quebec',
  R: 'Romeo',
  S: 'Sierra',
  T: 'Tango',
  U: 'Uniform',
  V: 'Victor',
  W: 'Whiskey',
  X: 'X-ray',
  Y: 'Yankee',
  Z: 'Zulu',
};

/**
 * Digit spoken-word map for grouped read-back.
 */
const DIGITS: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
};

/**
 * Converts a tracking reference or postcode string to a NATO phonetic read-back.
 *
 * Letters are expanded to their NATO phonetic word: "P" → "P for Papa".
 * Digits are converted to their spoken word: "1" → "one".
 * Spaces and other characters are passed through.
 *
 * Examples:
 *   readBack('PA12') → 'P for Papa, A for Alfa, one two'
 *   readBack('DE1 2AB') → 'D for Delta, E for Echo, one, space, two, A for Alfa, B for Bravo'
 */
export function readBack(value: string): string {
  const upper = value.toUpperCase();
  const parts: string[] = [];

  for (const char of upper) {
    if (char in NATO) {
      parts.push(`${char} for ${NATO[char]}`);
    } else if (char in DIGITS) {
      parts.push(DIGITS[char]);
    } else if (char === ' ') {
      parts.push('space');
    } else {
      parts.push(char);
    }
  }

  return parts.join(', ');
}
