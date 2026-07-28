import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './app.js';

const style = document.createElement('style');
style.textContent = `
  .loading-screen {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background:
      linear-gradient(135deg, rgba(82, 116, 55, 0.20), rgba(255, 216, 90, 0.16)),
      url('/static/images/register-bg.png') center / cover no-repeat,
      #6f8f45;
    color: white;
  }

  .spinner {
    width: 50px;
    height: 50px;
    border: 5px solid rgba(255, 255, 255, 0.3);
    border-radius: 50%;
    border-top-color: #4CAF50;
    animation: spin 1s ease-in-out infinite;
  }

  @keyframes spin {
    to { transform: rotate(360deg); }
  }
`;
document.head.appendChild(style);

const rootElement = document.getElementById('root');
if (rootElement) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(<App />);
} else {
  console.error('Root element was not found');
}
