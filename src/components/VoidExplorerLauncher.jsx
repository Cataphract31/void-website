import React from 'react';
import { Link } from 'react-router-dom';
import styled from 'styled-components';

const ExplorerSection = styled.div`
  background: rgba(155, 48, 255, 0.05);
  border: 1px solid rgba(155, 48, 255, 0.12);
  border-radius: 12px;
  padding: 20px;
  margin-top: 1.5rem;
  text-align: center;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
`;

const ExplorerText = styled.p`
  color: rgba(255, 255, 255, 0.6);
  font-size: 1rem;
  font-family: 'Space Grotesk', sans-serif;
  margin-top: 0;
  margin-bottom: 15px;
`;

const ExplorerButton = styled(Link)`
  display: inline-block;
  background: linear-gradient(135deg, #7B2FBE, #9B30FF);
  color: #ffffff;
  padding: 10px 24px;
  border-radius: 8px;
  text-decoration: none;
  font-weight: 600;
  font-family: 'Space Grotesk', sans-serif;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 20px rgba(155, 48, 255, 0.3);
    transform: translateY(-1px);
  }
`;

const ExplorerLauncher = () => {
  return (
    <ExplorerSection>
      <ExplorerText>Explore the VOID ecosystem in 3D</ExplorerText>
      <ExplorerButton to="/universe">Launch Explorer</ExplorerButton>
    </ExplorerSection>
  );
};

export default ExplorerLauncher;