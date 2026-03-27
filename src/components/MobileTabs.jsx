export function MobileTabs({ tabs, activeTab, onChange }) {
  return (
    <nav className="mobile-tabs" aria-label="Primary">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={tab.id === activeTab ? "tab-button is-selected" : "tab-button"}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
