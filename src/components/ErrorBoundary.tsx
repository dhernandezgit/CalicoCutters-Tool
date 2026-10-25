import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

/** Last-resort guard so a rendering/WebGL error never leaves a blank page. */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("CalicoCutters UI error", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="fatal-screen">
        <div className="fatal-card">
          <span className="eyebrow">CalicoCutters</span>
          <h1>Algo se ha atascado</h1>
          <p>
            La interfaz ha encontrado un error inesperado. Tus archivos siguen en este ordenador;
            prueba a recargar la página. Si vuelve a ocurrir, exporta el proyecto antes de cerrar
            y revisa la consola del navegador.
          </p>
          <code>{this.state.error.message}</code>
          <button type="button" className="primary" onClick={() => window.location.reload()}>
            Recargar CalicoCutters
          </button>
        </div>
      </div>
    );
  }
}
