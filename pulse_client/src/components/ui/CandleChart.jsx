import { useMemo } from 'react'
import { formatCurrency } from '../../lib/constants'

export default function CandleChart({ ticks = [], mode = 'Candles', basePrice = 1 }) {
  const chartData = useMemo(() => {
    let prices = []
    let timestamps = []

    if (Array.isArray(ticks) && ticks.length > 0) {
      prices = ticks.map((t) => Number(t.price || 0))
      timestamps = ticks.map((t) => {
        if (!t.created_at) return ''
        const d = new Date(t.created_at)
        return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      })
    }

    if (prices.length === 0) {
      const bp = Number(basePrice || 1)
      prices = [bp, bp * 1.02, bp * 1.01, bp * 1.05, bp * 1.04, bp * 1.08]
      timestamps = ['09:00', '11:00', '13:00', '15:00', '17:00', '19:00']
    } else if (prices.length === 1) {
      const bp = prices[0]
      prices = [bp * 0.98, bp, bp * 1.01, bp]
      timestamps = ['09:00', '12:00', '15:00', '18:00']
    }

    const minPrice = Math.min(...prices) * 0.98
    const maxPrice = Math.max(...prices) * 1.02
    const range = maxPrice - minPrice || 1

    const yLabels = [4, 3, 2, 1, 0].map((step) => {
      const val = minPrice + (range * step) / 4
      return formatCurrency(val)
    })

    const xStep = Math.max(1, Math.floor(timestamps.length / 4))
    const xLabels = []
    for (let i = 0; i < timestamps.length; i += xStep) {
      if (xLabels.length < 5 && timestamps[i]) xLabels.push(timestamps[i])
    }
    if (xLabels.length < 5 && timestamps.length > 0) {
      const last = timestamps[timestamps.length - 1]
      if (last && !xLabels.includes(last)) xLabels.push(last)
    }

    const width = 600
    const height = 220
    const points = prices.map((p, idx) => {
      const x = (idx / Math.max(1, prices.length - 1)) * width
      const y = height - ((p - minPrice) / range) * (height - 20) - 10
      return { x, y, price: p }
    })

    const svgPolyline = points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')
    const svgArea = `0,${height} ${svgPolyline} ${width},${height}`

    const candleCount = Math.min(24, Math.max(8, prices.length))
    const chunkSize = Math.max(1, Math.floor(prices.length / candleCount))
    const candles = []
    for (let i = 0; i < prices.length; i += chunkSize) {
      const chunk = prices.slice(i, i + chunkSize)
      const open = chunk[0]
      const close = chunk[chunk.length - 1]
      const high = Math.max(...chunk)
      const low = Math.min(...chunk)
      const isGreen = close >= open
      const pctHeight = Math.max(12, Math.min(90, ((high - minPrice) / range) * 100))
      candles.push({ open, close, high, low, isGreen, pctHeight })
    }

    return { yLabels, xLabels, points, svgPolyline, svgArea, candles }
  }, [ticks, basePrice])

  return (
    <div className="candle-chart">
      <div className="chart-y-axis">
        {chartData.yLabels.map((lbl, idx) => (
          <span key={idx}>{lbl}</span>
        ))}
      </div>

      <div className="chart-grid">
        <div className="grid-lines">
          <i /><i /><i /><i /><i />
        </div>

        {mode === 'Line' ? (
          <div className="line-chart-container" style={{ position: 'relative', width: '100%', height: '100%' }}>
            <svg viewBox="0 0 600 220" preserveAspectRatio="none" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#06b6d4" stopOpacity="0.3" />
                  <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.0" />
                </linearGradient>
              </defs>
              <polygon points={chartData.svgArea} fill="url(#chartGrad)" />
              <polyline points={chartData.svgPolyline} fill="none" stroke="#06b6d4" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
              {chartData.points.map((pt, idx) => (
                <circle key={idx} cx={pt.x} cy={pt.y} r="3" fill="#06b6d4" />
              ))}
            </svg>
          </div>
        ) : (
          <div className="candles">
            {chartData.candles.map((candle, idx) => (
              <span
                key={idx}
                className={`candle ${!candle.isGreen ? 'red' : ''}`}
                style={{ '--height': `${candle.pctHeight}%`, '--delay': `${idx * 0.02}s` }}
                title={`High: ${candle.high.toFixed(4)} / Low: ${candle.low.toFixed(4)}`}
              >
                <i />
              </span>
            ))}
          </div>
        )}

        <div className="chart-x-axis">
          {chartData.xLabels.map((lbl, idx) => (
            <span key={idx}>{lbl}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
