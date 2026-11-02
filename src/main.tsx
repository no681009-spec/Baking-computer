import React from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  hasError: boolean;
}

class RootErrorBoundary extends React.Component<
  {children: React.ReactNode},
  ErrorBoundaryState
> {
  constructor(props: {children: React.ReactNode}) {
    super(props);
    this.state = {hasError: false};
  }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return {hasError: true};
  }

  componentDidCatch(error: unknown) {
    console.error('Application render error:', error);
    try {
      localStorage.removeItem('bakers_calculator_saved_recipes_v2');
    } catch {
      // ignore storage errors
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#fdfbf7] flex items-center justify-center p-6 text-center">
          <div className="bg-white p-8 rounded-2xl border border-amber-200 max-w-md w-full shadow-sm">
            <h1 className="text-xl font-black text-amber-900 mb-2">
              🍞 烘焙材料計算器
            </h1>
            <p className="text-sm text-gray-600 mb-5">
              偵測到舊版快取資料異常，已自動清理完成。請點擊下方按鈕重新載入頁面。
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-5 py-2.5 bg-amber-800 hover:bg-amber-900 text-white font-bold rounded-lg text-sm cursor-pointer"
            >
              重新載入頁面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (rootElement) {
  createRoot(rootElement).render(
    <RootErrorBoundary>
      <App />
    </RootErrorBoundary>
  );
}
