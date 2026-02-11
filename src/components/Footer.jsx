import React from 'react';
import styled from 'styled-components';

const FooterWrapper = styled.footer`
  background-color: rgba(5, 5, 8, 0.9);
  border-top: 1px solid rgba(155, 48, 255, 0.08);
  padding: 1rem;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const SocialLinks = styled.div`
  display: flex;
  gap: 1.5rem;
  justify-content: center;
  align-items: center;
`;

const SocialLink = styled.a`
  color: rgba(255, 255, 255, 0.5);
  font-family: 'Space Grotesk', sans-serif;
  font-size: 0.85rem;
  font-weight: 500;
  text-decoration: none;
  letter-spacing: 0.05em;
  transition: color 0.3s ease, text-shadow 0.3s ease;
  
  &:hover {
    color: #b44aff;
    text-shadow: 0 0 8px rgba(155, 48, 255, 0.3);
  }
`;

const Footer = () => {
  return (
    <FooterWrapper>
      <SocialLinks>
        <SocialLink href="https://x.com/VOIDINSOL" target="_blank" rel="noopener noreferrer">
          Twitter
        </SocialLink>
        <SocialLink href="https://x.com/i/communities/2021674294166925617" target="_blank" rel="noopener noreferrer">
          Community
        </SocialLink>
        <SocialLink href="https://t.me/voidsolportal" target="_blank" rel="noopener noreferrer">
          Telegram
        </SocialLink>
        <SocialLink href="https://dexscreener.com/solana" target="_blank" rel="noopener noreferrer">
          DexScreener
        </SocialLink>
        <SocialLink href="https://birdeye.so" target="_blank" rel="noopener noreferrer">
          Birdeye
        </SocialLink>
      </SocialLinks>
    </FooterWrapper>
  );
};

export default Footer;
