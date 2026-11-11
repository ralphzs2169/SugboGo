import { Component } from "react";
import { Link } from "react-router-dom";
import DataErrorState from "@/shared/components/errors/DataErrorState";

/** Keep unexpected page rendering failures inside the Admin content region. */
export default class AdminRouteErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <section>
        <DataErrorState
          title="This page could not be displayed"
          message="An unexpected error occurred. Try opening the page again, or return to the dashboard."
          onRetry={() => this.setState({ failed: false })}
          retryLabel="Retry page"
        />
        <Link
          to="/admin-panel/dashboard"
          className="mt-4 inline-block text-sm font-medium text-primary underline"
        >
          Back to Admin Dashboard
        </Link>
      </section>
    );
  }
}
