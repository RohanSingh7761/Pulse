import { useState, useMemo } from 'react'
import { formatCurrency } from '../../lib/constants'

export default function CandleChart({ ticks = [], timeframe = '1D', basePrice = 1 }) {
  const [hoveredIndex, setHoveredIndex] = useState(null)

  const chartData = useMemo(() => {
    let filteredTicks = Array.isArray(ticks) ? [...ticks] : []

    if (filteredTicks.length > 0 && timeframe !== 'ALL') {
      const now = Date.now()
      let cutoff = 0

      if (timeframe === '1D') cutoff = now - 24 * 60 * 60 * 1000
      else if (timeframe === '5D') cutoff = now - 5 * 24 * 60 * 60 * 1000
      else if (timeframe === '1M') cutoff = now - 30 * 24 * 60 * 60 * 1000
      else if (timeframe === '1Y') cutoff = now - 365 * 24 * 60 * 60 * 1000
      else if (timeframe === 'YTD') {
        cutoff = new Date(new Date().getFullYear(), 0, 1).getTime()
      }

      if (cutoff > 0) {
        const afterCutoff = filteredTicks.filter((t) => {
          if (!t.created_at) return true
          return new Date(t.created_at).getTime() >= cutoff
        })
        if (afterCutoff.length > 0) {
          filteredTicks = afterCutoff
        }
      }
    }

    let prices = []
    let timestamps = []

    if (filteredTicks.length > 0) {
      prices = filteredTicks.map((t) => Number(t.price || 0))
      timestamps = filteredTicks.map((t) => {
        if (!t.created_at) return ''
        const d = new Date(t.created_at)
        return timeframe === '1D'
          ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
          : d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
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
      return { x, y, price: p, timestamp: timestamps[idx] || '' }
    })

    const svgPolyline = points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')
    const svgArea = `0,${height} ${svgPolyline} ${width},${height}`

    return { yLabels, xLabels, points, svgPolyline, svgArea }
  }, [ticks, timeframe, basePrice])

  const handleMouseMove = (e) => {
    if (!chartData.points || chartData.points.length === 0) return
    const rect = e.currentTarget.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const pct = Math.max(0, Math.min(1, mouseX / rect.width))
    const index = Math.round(pct * (chartData.points.length - 1))
    setHoveredIndex(index)
  }

  const handleMouseLeave = () => {
    setHoveredIndex(null)
  }

  const activePoint = (hoveredIndex !== null && chartData.points[hoveredIndex])
    ? chartData.points[hoveredIndex]
    : null

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

        <div
          className="line-chart-container"
          style={{ position: 'relative', width: '100%', height: '100%', cursor: 'crosshair' }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
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
              <circle
                key={idx}
                cx={pt.x}
                cy={pt.y}
                r={hoveredIndex === idx ? 5 : 3}
                fill={hoveredIndex === idx ? '#38bdf8' : '#06b6d4'}
              />
            ))}

            {activePoint && (
              <g>
                <line
                  x1={activePoint.x}
                  y1="0"
                  x2={activePoint.x}
                  y2="220"
                  stroke="rgba(6, 182, 212, 0.5)"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  vectorEffect="non-scaling-stroke"
                />
                <circle
                  cx={activePoint.x}
                  cy={activePoint.y}
                  r="6"
                  fill="#06b6d4"
                  stroke="#ffffff"
                  strokeWidth="2"
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}
          </svg>

          {activePoint && (
            <div
              style={{
                position: 'absolute',
                top: '6px',
                left: activePoint.x > 400 ? 'auto' : `${Math.max(5, (activePoint.x / 600) * 100 - 10)}%`,
                right: activePoint.x > 400 ? `${Math.max(5, 100 - (activePoint.x / 600) * 100 - 10)}%` : 'auto',
                background: 'rgba(11, 15, 20, 0.95)',
                border: '1px solid rgba(6, 182, 212, 0.6)',
                boxShadow: '0 4px 14px rgba(0, 0, 0, 0.6)',
                padding: '6px 12px',
                borderRadius: '6px',
                pointerEvents: 'none',
                zIndex: 10,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                whiteSpace: 'nowrap',
              }}
            >
              <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                {activePoint.timestamp ? activePoint.timestamp : 'Detail'}
              </span>
              <strong style={{ fontSize: '13px', color: '#38bdf8', fontFamily: 'monospace', fontWeight: 600 }}>
                {formatCurrency(activePoint.price)}
              </strong>
            </div>
          )}
        </div>

        <div className="chart-x-axis">
          {chartData.xLabels.map((lbl, idx) => (
            <span key={idx}>{lbl}</span>
          ))}
        </div>
      </div>
    </div>
  )
}

