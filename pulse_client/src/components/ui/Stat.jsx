export default function Stat({ label, value, note, positive }) {
  return (
    <div className="stat">
      <span className="mini-label">{label}</span>
      <strong>{value}</strong>
      {note && <span className={positive ? 'positive' : 'muted'}>{note}</span>}
    </div>
  )
}
