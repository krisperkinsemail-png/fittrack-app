export function DateNavigator({
  selectedDate,
  formattedDate,
  isTodaySelected,
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
        {!isTodaySelected ? (
          <button
            type="button"
            className="secondary-button is-selected-accent"
            onClick={onToday}
          >
            Go Back to Today
          </button>
        ) : null}
        <button type="button" className="secondary-button" onClick={onNext}>
          Next
        </button>
      </div>
    </section>
  );
}
