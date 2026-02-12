import React, { useRef, useState, useMemo } from 'react';
import styled from 'styled-components';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stars, PerspectiveCamera, Html, Billboard, Text, Sparkles, Float } from '@react-three/drei';
import * as THREE from 'three';
import { Link } from 'react-router-dom';

// ────────────────────────────────────────────
// Styled Components
// ────────────────────────────────────────────
const Container = styled.div`
  width: 100vw;
  height: 100vh;
  position: relative;
  background: #000;
  overflow: hidden;
`;

const BackLink = styled(Link)`
  position: absolute;
  top: 2rem;
  left: 2rem;
  color: #fff;
  text-decoration: none;
  font-family: 'Space Grotesk', sans-serif;
  font-size: 1.2rem;
  padding: 10px 20px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  border-radius: 30px;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(10px);
  z-index: 100;
  transition: all 0.3s ease;

  &:hover {
    background: rgba(155, 48, 255, 0.3);
    border-color: #b44aff;
    box-shadow: 0 0 20px rgba(155, 48, 255, 0.4);
  }
`;

const InfoCard = styled.div`
  background: rgba(10, 10, 20, 0.95);
  border: 1px solid #b44aff;
  width: 500px;
  padding: 32px;
  backdrop-filter: blur(25px);
  box-shadow: 0 0 80px rgba(155, 48, 255, 0.6);
  
  h2 {
    margin: 0 0 16px 0;
    font-family: 'Space Grotesk', sans-serif;
    color: #fff;
    font-size: 1.8rem;
    border-bottom: 2px solid rgba(180, 74, 255, 0.5);
    padding-bottom: 12px;
  }
  
  p {
    font-size: 1.1rem;
    line-height: 1.7;
    color: rgba(255, 255, 255, 0.9);
    font-family: 'Space Mono', monospace;
    margin-bottom: 24px;
  }
  
  .actions {
    display: flex;
    gap: 12px;
  }
  
  a {
    flex: 1.2;
    text-align: center;
    color: #fff;
    background: #b44aff;
    padding: 14px;
    border-radius: 10px;
    text-decoration: none;
    font-size: 1rem;
    font-weight: 700;
    transition: all 0.3s ease;
    
    &:hover {
      background: #c57fff;
      transform: translateY(-2px);
    }
  }

  button {
    flex: 1;
    background: rgba(255, 255, 255, 0.1);
    border: 1px solid rgba(255, 255, 255, 0.2);
    color: #fff;
    padding: 14px;
    border-radius: 10px;
    cursor: pointer;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s;

    &:hover {
      background: rgba(255, 255, 255, 0.2);
    }
  }
`;

// ────────────────────────────────────────────
// 3D Components
// ────────────────────────────────────────────

const Singularity = (props) => {
  return <Planet {...props} position={[0, 0, 0]} size={15} speed={0.05} color="#000000" emissiveOverride="#1a0033" />;
};

const Planet = ({ position, color, name, description, url, size = 1, speed = 0.5, emissiveOverride }) => {
  const mesh = useRef();
  const [hovered, setHover] = useState(false);
  const [active, setActive] = useState(false);

  const orbitOffset = useMemo(() => Math.random() * Math.PI * 2, []);
  const initialRadius = useMemo(() => {
    if (!position || !Array.isArray(position)) return 0;
    return Math.sqrt(position[0] ** 2 + position[2] ** 2);
  }, [position]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime() * speed + orbitOffset;
    if (mesh.current) {
      mesh.current.position.x = Math.sin(t) * initialRadius;
      mesh.current.position.z = Math.cos(t) * initialRadius;
      mesh.current.rotation.y += 0.005;
    }
  });

  return (
    <group ref={mesh}>
      <mesh
        onClick={(e) => { e.stopPropagation(); setActive(!active); }}
        onPointerOver={() => setHover(true)}
        onPointerOut={() => setHover(false)}
      >
        <sphereGeometry args={[size, 32, 32]} />
        <meshStandardMaterial
          color={color}
          emissive={emissiveOverride || color}
          emissiveIntensity={hovered ? 2.0 : (color === "#000000" ? 1.0 : 0.4)}
          metalness={0.9}
          roughness={0.1}
        />
      </mesh>

      {/* Label */}
      <Billboard position={[0, size + 1.2, 0]}>
        <Text
          fontSize={0.6}
          color={active ? "#b44aff" : "#ffffff"}
        >
          {name}
        </Text>
      </Billboard>

      {/* Ring if provided or based on size */}
      {size > 1.2 && (
        <mesh rotation={[Math.PI / 3, 0, 0]}>
          <torusGeometry args={[size * 1.6, 0.05, 16, 100]} />
          <meshBasicMaterial color={color} transparent opacity={0.2} />
        </mesh>
      )}

      {/* Modal / Card */}
      {active && (
        <Html center position={[0, 0, 0]} zIndexRange={[100, 0]}>
          <InfoCard>
            <h2>{name}</h2>
            <p>{description}</p>
            <div className="actions">
              <a href={url} target="_blank" rel="noopener noreferrer">View Pool ↗</a>
              <button onClick={() => setActive(false)}>Close</button>
            </div>
          </InfoCard>
        </Html>
      )}
    </group>
  );
};

const Scene = () => {
  return (
    <>
      <PerspectiveCamera makeDefault position={[0, 20, 40]} fov={50} />
      <OrbitControls
        enableDamping={true}
        dampingFactor={0.05}
        rotateSpeed={0.5}
        maxDistance={150}
        minDistance={5}
      />

      <ambientLight intensity={0.2} />
      <pointLight position={[0, 0, 0]} intensity={2.5} color="#b44aff" distance={100} />

      <Stars radius={150} depth={50} count={20000} factor={7} saturation={0.5} fade speed={1.5} />
      <Sparkles count={800} scale={50} size={3} speed={0.4} color="#b44aff" />

      <Singularity
        name="THE SINGULARITY (VOID / SOL)"
        description="The heart of the Void. A supermassive liquidity collapse where nearly 100 million SOL/VOID pairs sustain the project's gravity."
        url="https://dexscreener.com/solana/nkr7dkAuSPG2w8jksVeHTZmHRY8CMr6r1ekBG9eaPHb"
      />

      {/* WHITEWHALE / VOID */}
      <Planet
        position={[-18, 5, -15]}
        color="#F8FAFC" // Frozen White
        name="WHITEWHALE / VOID"
        description="A gargantuan ice planet orbiting the Void. Home to the legendary WhiteWhale/VOID Meteora DLMM pool."
        url="https://www.meteora.ag/dlmm/6rE8Ej3aae9QBukLYWFvzDAYmRgsygpKK1LbqLjHJGcL"
        size={1.6}
        speed={0.1}
      />

      {/* PENGUIN / VOID */}
      <Planet
        position={[22, -2, 12]}
        color="#7DD3FC" // Icy Blue
        name="PENGUIN / VOID"
        description="A playful yet treacherous icy moon. The PENGUIN/VOID Meteora DLMM pool provides deep cooling for the Void's engine."
        url="https://www.meteora.ag/dlmm/5jW3M4defHZgCAt27FQU7upeELu5yWroiax9nmd2Bv62"
        size={1.2}
        speed={0.25}
      />

      {/* Background Sphere */}
      <mesh scale={[150, 150, 150]}>
        <sphereGeometry />
        <meshBasicMaterial color="#020205" side={THREE.BackSide} />
      </mesh>
    </>
  );
};

const VoidUniversePage = () => {
  return (
    <Container>
      <BackLink to="/">← Back to Reality</BackLink>

      <Canvas
        gl={{ antialias: true }}
        onCreated={({ gl }) => {
          gl.setClearColor('#000000');
        }}
      >
        <Scene />
      </Canvas>

      <div style={{
        position: 'absolute',
        bottom: '30px',
        left: '50%',
        transform: 'translateX(-50%)',
        color: 'rgba(255,255,255,0.4)',
        fontFamily: 'Space Grotesk',
        fontSize: '0.9rem',
        letterSpacing: '0.1em',
        pointerEvents: 'none',
        textAlign: 'center'
      }}>
        DRAG TO ORBIT • SCROLL TO ZOOM • CLICK CELESTIAL BODIES FOR INTEL
      </div>
    </Container>
  );
};

export default VoidUniversePage;