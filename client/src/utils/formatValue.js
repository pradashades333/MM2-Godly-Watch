// Large-number suffixes (short scale) for games like Grow a Garden where
// item values run into the sextillions and beyond.
const VALUE_SUFFIXES = [
  { threshold: 1e30, suffix: "No" },
  { threshold: 1e27, suffix: "Oc" },
  { threshold: 1e24, suffix: "Sp" },
  { threshold: 1e21, suffix: "Sx" },
  { threshold: 1e18, suffix: "Qi" },
  { threshold: 1e15, suffix: "Qa" },
  { threshold: 1e12, suffix: "T" },
  { threshold: 1e9, suffix: "B" },
  { threshold: 1e6, suffix: "M" }
];

export function formatValue(value) {
  if (value == null || Number.isNaN(value)) {
    return "--";
  }

  const abs = Math.abs(value);
  for (const { threshold, suffix } of VALUE_SUFFIXES) {
    if (abs >= threshold) {
      const scaled = value / threshold;
      const digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
      return `${scaled.toFixed(digits).replace(/\.0+$/, "")}${suffix}`;
    }
  }

  return new Intl.NumberFormat("en-US").format(value);
}
