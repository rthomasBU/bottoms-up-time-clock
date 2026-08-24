// Black 56px topbar - opens every screen, including the login page, per the
// Bottoms Up brand kit's non-negotiable #5. No orange stripe on the topbar
// itself.
export function Topbar() {
  return (
    <div className="topbar">
      <img className="brand-logo" src="/logo.png" alt="Bottoms Up - Draft Beer. Hands Free." />
      <span className="divider">|</span>
      <div className="app-name">Time Clock</div>
      <a className="right" href="https://bottomsupbeer.com">
        bottomsupbeer.com
      </a>
    </div>
  );
}
