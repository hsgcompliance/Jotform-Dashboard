// components/ErrorBoundary.js
import { Component } from 'react';

export default class ErrorBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(e) { return { error: e }; }
  componentDidCatch(e, info) {
    console.error('Boundary caught:', e, info);
  }
  render() {
    return this.state.error
      ? <pre style={{ color:'red' }}>{String(this.state.error)}</pre>
      : this.props.children;
  }
}
