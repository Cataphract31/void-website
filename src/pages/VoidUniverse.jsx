import React from 'react';
import styled, { keyframes } from 'styled-components';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

const pulse = keyframes`
  0%, 100% { opacity: 0.3; }
  50% { opacity: 0.6; }
`;

const rotate = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

const Wrapper = styled.div`
  min-height: 80vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  text-align: center;
  font-family: 'Space Grotesk', sans-serif;
`;

const OrbContainer = styled.div`
  position: relative;
  width: 200px;
  height: 200px;
  margin-bottom: 3rem;
`;

const Orb = styled.div`
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: radial-gradient(circle, rgba(155, 48, 255, 0.15), rgba(0, 0, 0, 0.9));
  border: 1px solid rgba(155, 48, 255, 0.15);
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  box-shadow: 0 0 60px rgba(155, 48, 255, 0.1), inset 0 0 30px rgba(155, 48, 255, 0.05);
`;

const Ring = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  width: 180px;
  height: 180px;
  transform: translate(-50%, -50%);
  border: 1px solid rgba(155, 48, 255, 0.08);
  border-radius: 50%;
  animation: ${rotate} 15s linear infinite;
  
  &::after {
    content: '';
    position: absolute;
    top: -3px;
    left: 50%;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: rgba(155, 48, 255, 0.4);
    box-shadow: 0 0 10px rgba(155, 48, 255, 0.3);
  }
`;

const Title = styled(motion.h1)`
  font-size: 2.5rem;
  font-weight: 700;
  color: #ffffff;
  letter-spacing: 0.15em;
  margin-bottom: 1rem;
  text-shadow: 0 0 30px rgba(155, 48, 255, 0.15);
`;

const Subtitle = styled(motion.p)`
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0.15em;
  text-transform: uppercase;
  margin-bottom: 0.5rem;
  animation: ${pulse} 3s ease-in-out infinite;
`;

const Description = styled(motion.p)`
  font-size: 0.95rem;
  color: rgba(255, 255, 255, 0.4);
  max-width: 450px;
  line-height: 1.7;
  margin-bottom: 2.5rem;
`;

const BackLink = styled(Link)`
  color: rgba(155, 48, 255, 0.5);
  text-decoration: none;
  font-size: 0.85rem;
  letter-spacing: 0.1em;
  transition: color 0.3s ease;
  
  &:hover {
    color: #b44aff;
  }
`;

const VoidUniversePage = () => {
  return (
    <Wrapper>
      <OrbContainer>
        <Orb />
        <Ring />
      </OrbContainer>

      <Subtitle
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5 }}
      >
        Coming Soon
      </Subtitle>

      <Title
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.2 }}
      >
        VOID UNIVERSE
      </Title>

      <Description
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
      >
        The 3D ecosystem explorer will launch once the first pools are live.
        Watch every pool orbit the black hole in real-time.
      </Description>

      <BackLink to="/">← Back to Home</BackLink>
    </Wrapper>
  );
};

export default VoidUniversePage;