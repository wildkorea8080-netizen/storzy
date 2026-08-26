export type CurrencyCode = string;

export type Money = Readonly<{
  amountMinor: bigint;
  currency: CurrencyCode;
}>;

export function money(amountMinor: bigint | number, currency: CurrencyCode): Money {
  const normalizedCurrency = currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(normalizedCurrency)) {
    throw new Error(`Invalid ISO 4217 currency code: ${currency}`);
  }
  const normalizedAmount = typeof amountMinor === "number" ? BigInt(amountMinor) : amountMinor;
  return { amountMinor: normalizedAmount, currency: normalizedCurrency };
}

export function assertSameCurrency(values: readonly Money[]): CurrencyCode {
  const first = values[0];
  if (!first) throw new Error("At least one money value is required");
  if (values.some((value) => value.currency !== first.currency)) {
    throw new Error("Currency mismatch");
  }
  return first.currency;
}

export function sumMoney(values: readonly Money[]): Money {
  const currency = assertSameCurrency(values);
  return money(values.reduce((sum, value) => sum + value.amountMinor, 0n), currency);
}

export function marginBasisPoints(revenue: Money, variableCost: Money): number {
  assertSameCurrency([revenue, variableCost]);
  if (revenue.amountMinor <= 0n) throw new Error("Revenue must be positive");
  const numerator = (revenue.amountMinor - variableCost.amountMinor) * 10_000n;
  return Number(numerator / revenue.amountMinor);
}

