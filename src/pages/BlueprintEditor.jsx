import React from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar   from '../components/Topbar.jsx';
import Editor2D from '../components/Editor2D.jsx';
import Preview3D from '../components/Preview3D.jsx';

export default function BlueprintEditor() {
  const navigate = useNavigate();

  return (
    <div className="app">
      <Topbar onHome={() => navigate('/')} />
      <div className="split">
        <Editor2D />
        <Preview3D />
      </div>
    </div>
  );
}
