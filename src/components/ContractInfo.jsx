import React, { useState } from 'react';
import styled, { keyframes } from 'styled-components';
import { motion } from 'framer-motion';

const shimmer = keyframes`
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

const ContractInfoWrapper = styled(motion.div)`
  background: rgba(155, 48, 255, 0.04);
  border: 1px solid rgba(155, 48, 255, 0.08);
  border-radius: 16px;
  padding: 1.5rem 2rem;
  margin: 1rem auto;
  max-width: 480px;
  text-align: center;
  backdrop-filter: blur(12px);
  position: relative;
  overflow: hidden;
  transition: all 0.3s ease;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(155, 48, 255, 0.3), transparent);
    background-size: 200% 100%;
    animation: ${shimmer} 3s ease-in-out infinite;
  }

  &:hover {
    border-color: rgba(155, 48, 255, 0.15);
    box-shadow: 0 4px 20px rgba(155, 48, 255, 0.05);
  }
`;

const ContractText = styled.p`
  color: rgba(255, 255, 255, 0.3);
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.2em;
  margin: 0 0 12px 0;
  font-family: 'Space Grotesk', sans-serif;
`;

const AddressWrapper = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
`;

const ShortenedAddress = styled.a`
  font-family: 'Space Grotesk', monospace;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.5);
  background-color: rgba(155, 48, 255, 0.06);
  padding: 8px 16px;
  border-radius: 8px;
  text-decoration: none;
  border: 1px solid rgba(155, 48, 255, 0.08);
  transition: all 0.3s ease;
  letter-spacing: 0.05em;

  &:hover {
    color: #d68fff;
    border-color: rgba(155, 48, 255, 0.2);
    background-color: rgba(155, 48, 255, 0.1);
  }
`;

const CopyButton = styled.button`
  padding: 8px 16px;
  background: linear-gradient(135deg, #7B2FBE, #9B30FF);
  color: white;
  border: none;
  border-radius: 8px;
  cursor: pointer;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: -100%;
    width: 100%;
    height: 100%;
    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.15), transparent);
    transition: left 0.5s ease;
  }

  &:hover {
    box-shadow: 0 4px 15px rgba(155, 48, 255, 0.25);
    &::before {
      left: 100%;
    }
  }
`;

// Placeholder — fill in after token creation
const VOID_MINT = 'VOID_MINT_ADDRESS_HERE';

const ContractInfo = () => {
  const [copied, setCopied] = useState(false);
  const shortenedAddress = `${VOID_MINT.slice(0, 6)}...${VOID_MINT.slice(-4)}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(VOID_MINT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <ContractInfoWrapper
      initial={{ opacity: 0, y: 15 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5 }}
    >
      <ContractText>CA</ContractText>
      <AddressWrapper>
        <ShortenedAddress
          href={`https://solscan.io/token/${VOID_MINT}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          {shortenedAddress}
        </ShortenedAddress>
        <CopyButton onClick={handleCopy}>
          {copied ? '✓ Copied' : 'Copy'}
        </CopyButton>
      </AddressWrapper>
    </ContractInfoWrapper>
  );
};

export default ContractInfo;