import React from "react";
import i18n from "../i18n";

type ErrorBoundaryProps = {
  children: React.ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  message: string;
};

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, message: error.message || i18n.t("errors:unexpected") };
  }

  componentDidCatch(error: Error) {
    // Keep console output for debugging in development.
    console.error("UI ErrorBoundary caught:", error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="pageStack" style={{ padding: 24 }}>
          <div className="card">
            <div className="cardHeader">
              <div>
                <div className="eyebrow">{i18n.t("errors:somethingWentWrong")}</div>
                <div className="h3">{i18n.t("errors:couldNotRender")}</div>
              </div>
            </div>
            <div className="muted">{i18n.t("errors:errorPrefix", { message: this.state.message })}</div>
            <div className="modalActions">
              <button className="btn btnPrimary" onClick={() => window.location.reload()} type="button">
                {i18n.t("common:actions.reload")}
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
