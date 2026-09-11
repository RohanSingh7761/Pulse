export default function Brand({ compact = false }) {
  return (
    <div className={`brand ${compact ? 'brand-compact' : ''}`}>
      <span className="brand-mark">
        <span /><span /><span />
      </span>
      <strong>PULSE</strong>
    </div>
  )
}
