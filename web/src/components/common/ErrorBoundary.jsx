import React from 'react';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="container-page narrow">
          <div className="panel error-screen" style={{ margin: '40px auto', textAlign: 'center' }}>
            <h2>Something went wrong</h2>
            <p className="text-danger" style={{ margin: '16px 0' }}>
              {this.state.error?.message || 'An unexpected error occurred while rendering this page.'}
            </p>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <button 
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  this.setState({ hasError: false, error: null });
                  window.location.hash = '#/';
                }}
              >
                Return to shop
              </button>
              <button 
                type="button"
                className="btn btn-secondary"
                onClick={() => window.location.reload()}
              >
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

