import React from 'react';
import Topbar   from './components/Topbar.jsx';
import Editor2D from './components/Editor2D.jsx';
import Preview3D from './components/Preview3D.jsx';
import './App.css';

export default function App() {
  return (
    <div className="app">
      <Topbar />
      <div className="split">
        <Editor2D />
        <Preview3D />
      </div>
    </div>
  );
}
