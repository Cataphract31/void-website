import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const HeaderWrapper = styled.header`
  background-color: rgba(5, 5, 8, 0.95);
  backdrop-filter: blur(12px);
  padding: 0.5rem 1rem;
  position: relative;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid rgba(155, 48, 255, 0.1);
  z-index: 100;

  @media (max-width: 768px) {
    height: 50px;
  }
`;

const LogoWrapper = styled.div`
  position: absolute;
  top: 50%;
  left: 1rem;
  transform: translateY(-50%);
  z-index: 10;
  display: flex;
  align-items: center;
`;

const LogoText = styled(Link)`
  color: #ffffff;
  font-size: 1.6rem;
  font-weight: 700;
  font-family: 'Space Grotesk', sans-serif;
  letter-spacing: 0.15em;
  text-decoration: none;
  text-shadow: 0 0 20px rgba(155, 48, 255, 0.3);
  transition: text-shadow 0.3s ease;

  &:hover {
    text-shadow: 0 0 30px rgba(155, 48, 255, 0.5);
  }
`;

const Nav = styled.nav`
  display: flex;
  justify-content: flex-end;
  align-items: center;
  width: 100%;

  @media (max-width: 768px) {
    justify-content: flex-end;
  }
`;

const NavLink = styled(Link)`
  color: rgba(255, 255, 255, 0.7);
  text-decoration: none;
  margin: 0 1rem;
  font-size: 1rem;
  font-family: 'Space Grotesk', sans-serif;
  font-weight: 500;
  position: relative;
  transition: color 0.3s ease;

  &:after {
    content: '';
    position: absolute;
    width: 0;
    height: 2px;
    bottom: -4px;
    left: 0;
    background: linear-gradient(90deg, #9B30FF, #b44aff);
    transition: width 0.3s ease;
    border-radius: 1px;
  }

  &:hover {
    color: #d68fff;
    &:after {
      width: 100%;
    }
  }

  @media (max-width: 768px) {
    font-size: 0.9rem;
    margin: 0 0.5rem;
  }
`;

const Header = () => {
  return (
    <HeaderWrapper>
      <LogoWrapper>
        <LogoText to="/">VOID</LogoText>
      </LogoWrapper>
      <Nav>
        <NavLink to="/story">Story</NavLink>
        <NavLink to="/whitepaper">Whitepaper</NavLink>
        <NavLink to="/universe">Universe</NavLink>
        <NavLink to="/explorer">Explorer</NavLink>
      </Nav>
    </HeaderWrapper>
  );
};

export default Header;