export default function Sparkline({ accent = 'cyan', down = false }) {
  const points = down
    ? '0,14 12,8 24,12 36,7 48,15 60,11 72,17 84,13 96,21 108,18'
    : '0,22 12,17 24,19 36,11 48,16 60,7 72,12 84,4 96,8 108,1'
  return (
    <svg
      className={`sparkline spark-${accent}`}
      viewBox="0 0 108 24"
      preserveAspectRatio="none"
      aria-label="Price movement chart"
    >
      <polyline points={points} fill="none" stroke="currentColor" strokeWidth="1.7" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
