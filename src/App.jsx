import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation, Navigate } from 'react-router-dom';
import GlobalStyle from './styles/GlobalStyle';
import Background from './components/Background';
import Header from './components/Header';
import Footer from './components/Footer';
import Home from './pages/Home';
import Story from './pages/Story';
import Whitepaper from './pages/Whitepaper';
import Explorer from './pages/Explorer';
import VoidUniversePage from './pages/VoidUniverse';

const BackgroundWrapper = () => {
  const location = useLocation();
  const showBackground = ['/', '/story', '/whitepaper', '/universe', '/explorer'].includes(location.pathname);
  return showBackground ? <Background /> : null;
};

const MainLayout = () => (
  <>
    <Header />
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/story" element={<Story />} />
      <Route path="/whitepaper" element={<Whitepaper />} />
      <Route path="/universe" element={<VoidUniversePage />} />
      <Route path="/explorer" element={<Explorer />} />
    </Routes>
    <Footer />
  </>
);

function App() {
  return (
    <Router>
      <GlobalStyle />
      <BackgroundWrapper />
      <div className="App">
        <Routes>
          <Route path="/wp.pdf" element={<Navigate to="/whitepaper" replace />} />
          <Route path="/lore" element={<Navigate to="/story" replace />} />
          <Route path="*" element={<MainLayout />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;