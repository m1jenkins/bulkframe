import React from 'react';
import ReactDOM from 'react-dom/client';
import { CompactApp } from '../../app/CompactApp';
import '../../assets/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <CompactApp variant="popup" />
  </React.StrictMode>,
);
