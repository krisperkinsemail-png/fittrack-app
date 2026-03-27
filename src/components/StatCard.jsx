export function StatCard({ label, value, helper, tone = "default" }) {
  return (
    <article className={`stat-card stat-card--${tone}`}>
      <p>{label}</p>
      <strong>{value}</strong>
      <span>{helper}</span>
    </article>
  );
}
