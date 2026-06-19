const WHOLE_NUMBER_FORMATTER = new Intl.NumberFormat(undefined, {
  maximumFractionDigits: 0,
});

const DECIMAL_FORMATTER = new Intl.NumberFormat(undefined, {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/**
 * Formats money with an explicit currency code so shared "$" symbols are never ambiguous.
 * Price storage should remain split into numeric amount and currency_code columns.
 */
export function formatMoney(amount: number, currencyCode: string): string {
  const normalizedCurrencyCode = currencyCode.trim().toUpperCase();
  const hasDecimals = !Number.isInteger(amount);
  const formattedAmount = hasDecimals
    ? DECIMAL_FORMATTER.format(amount)
    : WHOLE_NUMBER_FORMATTER.format(amount);

  return `${normalizedCurrencyCode} ${formattedAmount}`;
}
