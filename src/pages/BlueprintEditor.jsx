import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Topbar from '../components/Topbar.jsx';
import SidePanel from '../components/SidePanel.jsx';
import Editor2D from '../components/Editor2D.jsx';
import Preview3D from '../components/Preview3D.jsx';
import useBlueprintStore from '../store/useBlueprintStore';

export default function BlueprintEditor() {
  const navigate = useNavigate();

  // Keyboard shortcuts: B/E/G tools, Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y history, [ ] floors
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const store = useBlueprintStore.getState();

      if (e.metaKey || e.ctrlKey) {
        if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          if (e.shiftKey) store.redo();
          else store.undo();
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          store.redo();
        }
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'b': store.setTool('paint'); break;
        case 'e': store.setTool('erase'); break;
        case 'g': store.setTool('fill'); break;
        case '[': store.changeLayer(-1); break;
        case ']': store.changeLayer(1); break;
        default: break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <div className="app">
      <Topbar onHome={() => navigate('/')} />
      <div className="workspace">
        <SidePanel />
        <div className="split">
          <Editor2D />
          <Preview3D />
        </div>
      </div>
    </div>
  );
}
