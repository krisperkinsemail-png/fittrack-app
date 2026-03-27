export function DateNavigator({
  selectedDate,
  formattedDate,
  onPrevious,
  onNext,
  onToday,
}) {
  return (
    <section className="card date-card">
      <div>
        <p className="eyebrow">Selected day</p>
        <h2>{formattedDate}</h2>
      </div>
      <div className="date-controls">
        <button type="button" className="secondary-button" onClick={onPrevious}>
          Prev
        </button>
        <button type="button" className="secondary-button" onClick={onToday}>
          Today
        </button>
        <button type="button" className="secondary-button" onClick={onNext}>
          Next
        </button>
      </div>
    </section>
  );
}
