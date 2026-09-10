import React from 'react';
import ReactDOM from 'react-dom/client';
import { DashboardApp } from '../../app/DashboardApp';
import '../../assets/global.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DashboardApp />
  </React.StrictMode>,
);
