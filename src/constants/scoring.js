export const VOICE_WEIGHTS = {
  cssr: 0.3125,
  cdr: 0.375,
  cstAvg: 0.0625,
  cstOver15: 0.0875,
  cstP10: 0.0375,
  mosAvg: 0.0438,
  mosUnder16: 0.0562,
  mosP90: 0.025,
};

export const DATA_WEIGHTS = {
  http: {
    successRatio: 0.055,
    dlAvg: 0.035,
    dlP10: 0.045,
    dlP90: 0.0175,
    ulAvg: 0.035,
    ulP10: 0.045,
    ulP90: 0.0175,
  }, // sums to 0.25
  browsing: {
    successRatio: 0.25333,
    durationAvg: 0.10857,
    durationOver6: 0.0181,
  }, // 0.38
  streaming: {
    successRatio: 0.1276,
    mosAvg: 0.0363,
    mosP10: 0.0363,
    setupAvg: 0.0099,
    setupOver10: 0.0099,
  }, // 0.22
  social: {
    successRatio: 0.100005,
    durationAvg: 0.042855,
    durationOver15: 0.00714,
  }, // 0.15
};

export const OVERALL_WEIGHTS = {
  voice: 0.4,
  data: 0.6,
};

export const THRESHOLDS = {
  voice: {
    cssr: { good: 1.0, bad: 0.85, higherIsBetter: true },
    cdr: { good: 0.0, bad: 0.1, higherIsBetter: false },
    cstAvg: { good: 4.5, bad: 12, higherIsBetter: false },
    cstOver15: { good: 0.0, bad: 0.03, higherIsBetter: false },
    cstP10: { good: 4.0, bad: 8.0, higherIsBetter: false },
    mosAvg: { good: 4.3, bad: 2.0, higherIsBetter: true },
    mosUnder16: { good: 0.0, bad: 0.10, higherIsBetter: false },
    mosP90: { good: 4.75, bad: 4.0, higherIsBetter: true },
  },
  http: {
    successRatio: { good: 1.0, bad: 0.8, higherIsBetter: true },
    dlAvg: { good: 100, bad: 1, higherIsBetter: true },
    dlP10: { good: 40, bad: 1, higherIsBetter: true },
    dlP90: { good: 240, bad: 10, higherIsBetter: true },
    ulAvg: { good: 50, bad: 0.5, higherIsBetter: true },
    ulP10: { good: 30, bad: 0.5, higherIsBetter: true },
    ulP90: { good: 100, bad: 5, higherIsBetter: true },
  },
  browsing: {
    successRatio: { good: 1.0, bad: 0.8, higherIsBetter: true },
    durationAvg: { good: 1.0, bad: 6.0, higherIsBetter: false },
    durationOver6: { good: 0.0, bad: 0.15, higherIsBetter: false },
  },
  streaming: {
    successRatio: { good: 1.0, bad: 0.8, higherIsBetter: true },
    mosAvg: { good: 4.5, bad: 3.0, higherIsBetter: true },
    mosP10: { good: 4.0, bad: 2.0, higherIsBetter: true },
    setupAvg: { good: 2.0, bad: 7.0, higherIsBetter: false },
    setupOver10: { good: 0.0, bad: 0.05, higherIsBetter: false },
  },
  social: {
    successRatio: { good: 1.0, bad: 0.8, higherIsBetter: true },
    durationAvg: { good: 3.0, bad: 15.0, higherIsBetter: false },
    durationOver15: { good: 0.0, bad: 0.05, higherIsBetter: false },
  },
};


