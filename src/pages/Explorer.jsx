import React, { useState, useEffect } from 'react';
import styled from 'styled-components';
import { getVoidStats, getBurnHistory, formatNumber, shortenAddress } from '../utils/solana';

const ExplorerContainer = styled.div`
  padding: 80px 20px;
  min-height: 100vh;
  color: #fff;
  font-family: 'Space Grotesk', sans-serif;
  max-width: 1200px;
  margin: 0 auto;
`;

const Title = styled.h1`
  font-size: 3rem;
  text-align: center;
  margin-bottom: 2rem;
  text-shadow: 0 0 20px rgba(155, 48, 255, 0.5);
  background: linear-gradient(180deg, #fff, #b44aff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 20px;
  margin-bottom: 4rem;
`;

const StatCard = styled.div`
  background: rgba(10, 10, 15, 0.6);
  border: 1px solid rgba(155, 48, 255, 0.2);
  padding: 20px;
  border-radius: 12px;
  backdrop-filter: blur(10px);
  text-align: center;
  transition: transform 0.3s ease, box-shadow 0.3s ease;

  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 0 30px rgba(155, 48, 255, 0.15);
    border-color: rgba(155, 48, 255, 0.4);
  }

  h3 {
    color: rgba(255, 255, 255, 0.6);
    font-size: 0.9rem;
    margin-bottom: 10px;
    letter-spacing: 1px;
    text-transform: uppercase;
  }

  p {
    font-size: 1.8rem;
    font-weight: 700;
    color: #fff;
    text-shadow: 0 0 10px rgba(155, 48, 255, 0.3);
  }

  .sub {
    font-size: 0.8rem;
    color: #b44aff;
    margin-top: 5px;
  }
`;

const TableContainer = styled.div`
  background: rgba(10, 10, 15, 0.6);
  border: 1px solid rgba(155, 48, 255, 0.2);
  border-radius: 12px;
  padding: 20px;
  overflow-x: auto;

  h2 {
    font-size: 1.5rem;
    margin-bottom: 20px;
    color: #fff;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
`;

const Table = styled.table`
  width: 100%;
  border-collapse: collapse;
  
  th, td {
    text-align: left;
    padding: 15px;
    border-bottom: 1px solid rgba(155, 48, 255, 0.1);
  }

  th {
    color: rgba(255, 255, 255, 0.5);
    font-weight: 500;
    font-size: 0.9rem;
    text-transform: uppercase;
    letter-spacing: 1px;
  }

  td {
    color: #eee;
    font-family: 'Space Mono', monospace;
    font-size: 0.9rem;
  }

  tr:last-child td {
    border-bottom: none;
  }

  tr:hover td {
    background: rgba(155, 48, 255, 0.05);
  }

  a {
    color: #b44aff;
    text-decoration: none;
    transition: color 0.2s;
    
    &:hover {
      color: #fff;
      text-shadow: 0 0 10px #b44aff;
    }
  }
`;

const FireIcon = () => <span style={{ fontSize: '1.2rem', marginRight: '5px' }}>🔥</span>;

const Explorer = () => {
  const [stats, setStats] = useState({
    currentSupply: 0,
    burnedAmount: 0,
    burnPercentage: 0
  });
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nextBurn, setNextBurn] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const s = await getVoidStats();
      if (s) setStats(s);

      const h = await getBurnHistory(20); // Search deeper
      if (h && h.length > 0) {
        setHistory(h);
        // Calculate next burn time: Last burn + 12 hours
        const lastBurnTime = h[0].blockTime * 1000;
        const target = lastBurnTime + (12 * 60 * 60 * 1000);
        setNextBurn(target);
      } else {
        setHistory([]);
        // Fallback: If no burns found in recent history, estimate based on 12h cycle
        setNextBurn(Date.now() + (11 * 60 * 60 * 1000));
      }

      setLoading(false);
    };

    fetchData();
    const interval = setInterval(fetchData, 60000); // Poll every 1m
    return () => clearInterval(interval);
  }, []);

  // Countdown renderer
  const [timeLeft, setTimeLeft] = useState("");

  useEffect(() => {
    if (!nextBurn) return;
    const timer = setInterval(() => {
      const now = Date.now();
      const diff = nextBurn - now;
      if (diff <= 0) {
        setTimeLeft("Imminent");
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        setTimeLeft(`${h}h ${m}m`);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [nextBurn]);

  return (
    <ExplorerContainer>
      <Title>VOID Explorer</Title>

      <StatsGrid>
        <StatCard>
          <h3>Circulating Supply</h3>
          <p>{formatNumber(stats.currentSupply, 0)}</p>
          <div className="sub">VOID</div>
        </StatCard>

        <StatCard>
          <h3>Total Burned</h3>
          <p>{formatNumber(stats.burnedAmount, 0)}</p>
          <div className="sub">{formatNumber(stats.burnPercentage)}% of Total</div>
        </StatCard>

        <StatCard>
          <h3>Next Burn Event</h3>
          <p>{timeLeft || "Computing..."}</p>
          <div className="sub">{history.length > 0 ? "Based on 12h Cycle" : "Awaiting First Burn"}</div>
        </StatCard>
      </StatsGrid>

      <TableContainer>
        <h2>Latest Burns</h2>
        {loading ? (
          <p style={{ textAlign: 'center', padding: '20px', color: '#666' }}>Scanning the Void...</p>
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Time (UTC)</th>
                <th>Amount (VOID)</th>
                <th>Burner</th>
                <th>Signature</th>
              </tr>
            </thead>
            <tbody>
              {history.map((tx) => (
                <tr key={tx.signature}>
                  <td>{new Date(tx.blockTime * 1000).toLocaleString()}</td>
                  <td><FireIcon />{formatNumber(tx.amount)}</td>
                  <td><a href={`https://solscan.io/account/${tx.burner}`} target="_blank" rel="noreferrer">{shortenAddress(tx.burner)}</a></td>
                  <td><a href={`https://solscan.io/tx/${tx.signature}`} target="_blank" rel="noreferrer">View TX ↗</a></td>
                </tr>
              ))}
              {history.length === 0 && (
                <tr>
                  <td colSpan="4" style={{ textAlign: 'center' }}>No recent burns found</td>
                </tr>
              )}
            </tbody>
          </Table>
        )}
      </TableContainer>
    </ExplorerContainer>
  );
};

export default Explorer;
