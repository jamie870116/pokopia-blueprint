import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home            from './pages/Home.jsx';
import BlueprintEditor from './pages/BlueprintEditor.jsx';
import PokedexList     from './pages/Pokedex/PokedexList.jsx';
import PokedexDetail   from './pages/Pokedex/PokedexDetail.jsx';
import './App.css';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/"                element={<Home />} />
        <Route path="/blueprint"       element={<BlueprintEditor />} />
        <Route path="/pokedex"         element={<PokedexList />} />
        <Route path="/pokedex/:slug"   element={<PokedexDetail />} />
      </Routes>
    </BrowserRouter>
  );
}
