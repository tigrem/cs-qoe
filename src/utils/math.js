export const safeAverage = (values = []) => {
  if (!values?.length) return null;
  const sum = values.reduce((acc, val) => acc + val, 0);
  return sum / values.length;
};

export const percentile = (values = [], percentileValue) => {
  if (!values?.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * percentileValue;
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) {
    return sorted[lower];
  }
  const fraction = idx - lower;
  return sorted[lower] + (sorted[upper] - sorted[lower]) * fraction;
};

export const ratio = (numerator, denominator) => {
  if (!denominator || denominator === 0) return null;
  return numerator / denominator;
};

export const scoreLinear = (value, good, bad, higherIsBetter = true) => {
  if (value === null || value === undefined) return null;
  const [best, worst] = higherIsBetter
    ? [good, bad]
    : [bad, good];

  if (higherIsBetter) {
    if (value >= good) return 1;
    if (value <= bad) return 0;
    return (value - bad) / (good - bad);
  }

  if (value <= good) return 1;
  if (value >= bad) return 0;
  return (bad - value) / (bad - good);
};

export const weightedScore = (entries = []) => {
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  if (!totalWeight) return { score: null, appliedWeight: 0 };

  const scoreSum = entries.reduce(
    (sum, entry) => sum + entry.score * entry.weight,
    0
  );
  return { score: scoreSum / totalWeight, appliedWeight: totalWeight };
};


