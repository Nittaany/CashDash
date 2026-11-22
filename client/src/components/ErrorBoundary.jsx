import { Component } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error caught by boundary:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-950 p-4">
          <div className="card max-w-md w-full text-center">
            <AlertTriangle className="w-16 h-16 text-rose-500 mx-auto mb-4" />
            <h1 className="text-xl font-semibold text-slate-100 mb-2">
              Something went wrong
            </h1>
            <p className="text-slate-400 mb-6">
              An unexpected error occurred. Please reload the app.
            </p>
            <button
              onClick={this.handleReload}
              className="btn-primary inline-flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Reload App
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
