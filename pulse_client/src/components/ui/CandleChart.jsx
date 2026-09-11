export default function CandleChart() {
  const candles = [16, 24, 20, 29, 19, 34, 26, 41, 32, 38, 44, 36, 48, 43, 53, 49, 62, 58, 67, 63, 71, 64, 77, 74]
  return (
    <div className="candle-chart">
      <div className="chart-y-axis">
        <span>$5.20</span><span>$4.80</span><span>$4.40</span><span>$4.00</span><span>$3.60</span>
      </div>
      <div className="chart-grid">
        <div className="grid-lines"><i /><i /><i /><i /><i /></div>
        <div className="candles">
          {candles.map((height, index) => (
            <span
              key={index}
              className={`candle ${index % 5 === 3 ? 'red' : ''}`}
              style={{ '--height': `${height}%`, '--delay': `${index * 0.03}s` }}
            >
              <i />
            </span>
          ))}
        </div>
        <div className="chart-x-axis">
          <span>09:00</span><span>12:00</span><span>15:00</span><span>18:00</span><span>21:00</span>
        </div>
      </div>
    </div>
  )
}
