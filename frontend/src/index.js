  import React from 'react';
  import ReactDOM from 'react-dom/client';
  import './index.css';
  import App from './components/App.jsx';
  import ErrorBoundary from './components/ErrorBoundary.jsx';
  import reportWebVitals from './reportWebVitals.js';
  import { BrowserRouter } from 'react-router-dom';


  const root = ReactDOM.createRoot(document.getElementById('root'));
  root.render(
    <React.StrictMode>

        <BrowserRouter>
          <ErrorBoundary>
            <App />
          </ErrorBoundary>
        </BrowserRouter>

    </React.StrictMode>
  );

  reportWebVitals();
