import { createGlobalStyle } from 'styled-components';

const GlobalStyle = createGlobalStyle`
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');

  html, body {
    overflow-x: hidden;
    width: 100%;
    position: relative;
    font-family: 'Space Grotesk', sans-serif;
    background-color: #050508;
    color: #e0e0e0;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    letter-spacing: -0.02em;
  }

  h2 {
    font-size: 2rem;
    font-weight: 600;
  }

  h3 {
    font-size: 1.75rem;
    font-weight: 500;
  }

  p {
    font-size: 1.125rem;
    line-height: 1.7;
  }

  .App {
    text-align: center;
  }

  .App-header {
    background-color: #050508;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-size: calc(10px + 2vmin);
    color: #e0e0e0;
  }

  .custom-link {
    color: #b44aff;
    font-weight: bold;
    text-decoration: none;
    transition: color 0.3s ease, text-shadow 0.3s ease;
  }

  .custom-link:hover {
    color: #d68fff;
    text-decoration: underline;
    text-shadow: 0 0 8px rgba(155, 48, 255, 0.4);
  }

  ::selection {
    background: rgba(155, 48, 255, 0.3);
    color: #ffffff;
  }

  ::-webkit-scrollbar {
    width: 6px;
  }

  ::-webkit-scrollbar-track {
    background: #0a0a12;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(155, 48, 255, 0.4);
    border-radius: 3px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(155, 48, 255, 0.6);
  }
`;

export default GlobalStyle;