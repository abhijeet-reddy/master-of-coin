/**
 * Split calculation utilities for dividing transaction amounts equally.
 */

/**
 * Convert a dollar amount to cents to avoid floating point issues
 */
const toCents = (amount: number): number => Math.round(amount * 100);

/**
 * Convert cents back to a dollar string with 2 decimal places
 */
const centsToString = (cents: number): string => (cents / 100).toFixed(2);

/**
 * Shuffle an array in place using Fisher-Yates algorithm
 */
const shuffleInPlace = <T>(array: T[]): T[] => {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
};

/**
 * Distribute remainder pennies randomly across split indices
 *
 * @param baseAmounts - Array of base cent amounts for each split
 * @param remainderCents - Total remainder pennies to distribute
 * @returns Updated amounts with pennies distributed
 */
const distributeRemainder = (baseAmounts: number[], remainderCents: number): number[] => {
  const amounts = [...baseAmounts];
  const pennyCount = Math.min(remainderCents, amounts.length);

  // Create shuffled indices for random penny assignment
  const indices = shuffleInPlace(amounts.map((_, i) => i));

  for (let i = 0; i < pennyCount; i++) {
    amounts[indices[i]] += 1;
  }

  return amounts;
};

/**
 * Calculate equal split amounts per person with remainder distribution
 *
 * Divides the total amount equally among all participants (splits + user).
 * Each amount is rounded to 2 decimal places. Extra pennies from rounding
 * are distributed randomly among the split participants.
 *
 * @param totalAmount - Total transaction amount
 * @param splitCount - Number of people splitting (excluding the user)
 * @returns Array of split amount strings (length = splitCount), each with max 2 decimals
 *
 * @example
 * calculateEqualSplits(100, 2) // ["33.33", "33.34"] (user keeps 33.33)
 * calculateEqualSplits(10, 3)  // ["2.50", "2.50", "2.50"] (user keeps 2.50)
 */
export const calculateEqualSplits = (totalAmount: number, splitCount: number): string[] => {
  if (totalAmount <= 0 || splitCount <= 0) {
    return Array.from<string>({ length: splitCount }).fill('0');
  }

  const participants = splitCount + 1; // splits + user
  const totalCents = toCents(totalAmount);
  const baseCentsPerPerson = Math.floor(totalCents / participants);
  const remainderCents = totalCents - baseCentsPerPerson * participants;

  const baseAmounts = Array.from<number>({ length: splitCount }).fill(baseCentsPerPerson);
  const finalAmounts = distributeRemainder(baseAmounts, remainderCents);

  return finalAmounts.map(centsToString);
};
