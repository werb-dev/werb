import { Component, type ReactNode } from "react";

/**
 * Catches uncaught render errors anywhere below it and shows a recovery
 * screen instead of a blank page. Mounted once at the App root so a bad
 * render in any screen doesn't strand the brewer with nothing.
 *
 * React only resets ErrorBoundary state when `key` changes — we offer
 * two recovery paths: "Try again" remounts the children (clears the
 * error state in place), and "Reload" does a full page refresh (clean
 * slate, also re-fetches the bundle so users on the PWA pick up the
 * latest service-worker update).
 */
interface State {
  error: Error | null;
  // Forces children to remount when the brewer hits "Try again".
  resetKey: number;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  override state: State = { error: null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, info: { componentStack?: string }) {
    // No telemetry by design — log to the console so a brewer hitting
    // an issue can copy the stack into a bug report. componentStack is
    // the human-readable React tree path which is far more useful than
    // the JS stack for tracking down render bugs.
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  private tryAgain = () => {
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  private reload = () => {
    // Full reload — also nudges the service worker to swap in a newer
    // bundle if one is waiting.
    window.location.reload();
  };

  override render() {
    if (this.state.error) {
      return (
        <div className="min-h-dvh bg-bg text-text flex items-center justify-center px-6">
          <div className="max-w-md w-full rounded-2xl bg-surface border border-border p-6 sm:p-8">
            <p className="text-caption uppercase tracking-widest text-danger font-medium">
              Something went wrong
            </p>
            <h1 className="text-h2 font-semibold mt-2">
              Werb hit an unexpected error
            </h1>
            <p className="text-body-sm text-text-muted mt-3">
              Your data is safe — nothing is saved automatically when a
              render fails. Try again, or reload if it persists.
            </p>
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-bg border border-border p-3 text-caption font-mono text-text-muted whitespace-pre-wrap break-all">
              {this.state.error.message}
            </pre>
            <div className="mt-6 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={this.tryAgain}
                className="px-5 py-2.5 rounded-lg bg-accent text-bg text-body-sm font-medium hover:opacity-90 transition-opacity min-h-[40px]"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={this.reload}
                className="px-5 py-2.5 rounded-lg bg-surface-raised border border-border text-body-sm font-medium hover:border-accent hover:text-accent transition-colors min-h-[40px]"
              >
                Reload
              </button>
            </div>
            <p className="text-caption text-text-muted mt-5">
              If this keeps happening,{" "}
              <a
                href="https://github.com/werb-dev/werb/issues/new"
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                file an issue
              </a>{" "}
              and include the message above.
            </p>
          </div>
        </div>
      );
    }
    return (
      <ErrorBoundaryReset key={this.state.resetKey}>
        {this.props.children}
      </ErrorBoundaryReset>
    );
  }
}

/**
 * Stable wrapper whose `key` change forces a remount of the children
 * when the brewer presses "Try again". Lets the boundary recover
 * without a full page reload.
 */
function ErrorBoundaryReset({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
