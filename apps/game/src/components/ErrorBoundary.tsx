import { Component, type ReactNode } from 'react';
import { i18n } from '@melina/shared';

/** If something unexpected happens in the interface, show a message instead of an empty screen. */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: Error) {
    console.error('[interface]', error.message);
  }
  override render() {
    if (this.state.failed) {
      return (
        <div className="home" lang="fr-CA">
          <h1>🌻 Le jardin de Melina</h1>
          <p className="big-text">Oups! Un petit problème. On recommence?</p>
          <p className="muted">{i18n.child.progressSaved}</p>
          <button className="btn primary huge" onClick={() => window.location.reload()}>
            Recommencer
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
