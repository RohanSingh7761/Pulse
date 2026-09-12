export default function Sparkline({ accent = 'cyan', down = false, data = null }) {
  let points = ''
  if (Array.isArray(data) && data.length > 1) {
    const rawPrices = data.map((d) => (typeof d === 'number' ? d : Number(d.price || 0)))
    const min = Math.min(...rawPrices)
    const max = Math.max(...rawPrices)
    const range = max - min || 1
    const width = 108
    const height = 24
    points = rawPrices
      .map((val, idx) => {
        const x = (idx / (rawPrices.length - 1)) * width
        const normalizedY = (val - min) / range
        const y = height - (normalizedY * (height - 4) + 2)
        return `${x.toFixed(1)},${y.toFixed(1)}`
      })
      .join(' ')
  } else {
    points = down
      ? '0,14 12,8 24,12 36,7 48,15 60,11 72,17 84,13 96,21 108,18'
      : '0,22 12,17 24,19 36,11 48,16 60,7 72,12 84,4 96,8 108,1'
  }

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
