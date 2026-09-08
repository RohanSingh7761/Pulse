import Decimal from 'decimal.js';

Decimal.set({ precision: 40, rounding: Decimal.ROUND_DOWN });

function decimal(value, name) {
  try {
    const result = new Decimal(value);
    if (!result.isFinite()) throw new Error('not finite');
    return result;
  } catch {
    throw new Error(`${name} must be a finite decimal`);
  }
}

function nonNegative(value, name) {
  const result = decimal(value, name);
  if (result.isNegative()) throw new Error(`${name} cannot be negative`);
  return result;
}

function priceAt({ basePrice, slope }, supply) {
  return decimal(basePrice, 'basePrice').plus(decimal(slope, 'slope').times(nonNegative(supply, 'supply')));
}

function format(value) {
  return value.toFixed(18).replace(/\.?0+$/, '') || '0';
}

export function quoteBuy({ basePrice, slope, supply, amount, maxSupply }) {
  const start = nonNegative(supply, 'supply');
  const quantity = nonNegative(amount, 'amount');
  const end = start.plus(quantity);
  if (quantity.isZero()) throw new Error('amount must be greater than zero');
  if (maxSupply !== undefined && end.gt(nonNegative(maxSupply, 'maxSupply'))) throw new Error('maximum supply exceeded');

  const a = decimal(basePrice, 'basePrice');
  const b = decimal(slope, 'slope');
  const cost = a.times(quantity).plus(b.times(end.pow(2).minus(start.pow(2))).div(2));
  const before = priceAt({ basePrice: a, slope: b }, start);
  const after = priceAt({ basePrice: a, slope: b }, end);
  return {
    tokenAmount: format(quantity),
    settlementAmount: format(cost),
    priceBefore: format(before),
    priceAfter: format(after),
    priceImpact: format(before.isZero() ? new Decimal(0) : after.minus(before).div(before).times(100))
  };
}

export function quoteSell({ basePrice, slope, supply, amount, reserveBalance }) {
  const end = nonNegative(supply, 'supply');
  const quantity = nonNegative(amount, 'amount');
  if (quantity.isZero()) throw new Error('amount must be greater than zero');
  if (quantity.gt(end)) throw new Error('cannot sell more than circulating supply');
  const start = end.minus(quantity);
  const a = decimal(basePrice, 'basePrice');
  const b = decimal(slope, 'slope');
  const payout = a.times(quantity).plus(b.times(end.pow(2).minus(start.pow(2))).div(2));
  if (reserveBalance !== undefined && payout.gt(nonNegative(reserveBalance, 'reserveBalance'))) throw new Error('insufficient reserve');
  const before = priceAt({ basePrice: a, slope: b }, end);
  const after = priceAt({ basePrice: a, slope: b }, start);
  return {
    tokenAmount: format(quantity),
    settlementAmount: format(payout),
    priceBefore: format(before),
    priceAfter: format(after),
    priceImpact: format(before.isZero() ? new Decimal(0) : before.minus(after).div(before).times(100))
  };
}

export { priceAt };