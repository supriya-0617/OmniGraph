import React from 'react';
import ReactDOMClient from 'react-dom/client';
// Global design tokens must load before any page/component stylesheet.
import './index.css';
import App from './App';

ReactDOMClient.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
