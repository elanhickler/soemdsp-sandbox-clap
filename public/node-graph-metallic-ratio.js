// A tribute module: Robin Schmidt's RAPT::rsRatioGenerator::metallic()
// formula from RS-MET (https://github.com/RobinSchmidt/RS-MET), ported
// directly. metallic(n) = (n + sqrt(n^2 + 4)) / 2 -- the "metallic mean"
// family: n=0 -> 1, n=1 -> golden ratio, n=2 -> silver, n=3 -> bronze.
// https://en.wikipedia.org/wiki/Metallic_mean
// Mirrors native_modules/metallic_ratio exactly.

function nodeGraphMetallicRatioSample(index) {
  const n = Number(index) || 0;
  return {
    Ratio: 0.5 * (n + Math.sqrt(n * n + 4)),
  };
}
