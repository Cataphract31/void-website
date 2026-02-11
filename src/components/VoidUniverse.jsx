import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { EXRLoader } from 'three/examples/jsm/loaders/EXRLoader';

const LoadingScreen = ({ progress }) => {
  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      backgroundColor: 'rgba(5, 5, 8, 0.95)',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      color: 'white',
      fontFamily: "'Space Grotesk', sans-serif",
      fontSize: '20px',
      zIndex: 1000
    }}>
      <p style={{ letterSpacing: '0.2em', color: 'rgba(255,255,255,0.6)' }}>
        LOADING VOID UNIVERSE
      </p>
      <div style={{
        width: '200px',
        height: '4px',
        backgroundColor: 'rgba(155, 48, 255, 0.15)',
        borderRadius: '2px',
        overflow: 'hidden',
        marginTop: '20px'
      }}>
        <div style={{
          width: `${progress}%`,
          height: '100%',
          background: 'linear-gradient(90deg, #7B2FBE, #9B30FF)',
          transition: 'width 0.3s ease-in-out'
        }}></div>
      </div>
      <p style={{ fontSize: '12px', marginTop: '10px', color: 'rgba(255,255,255,0.3)' }}>
        {Math.round(progress)}%
      </p>
    </div>
  );
};

// Placeholder pools — replace with real Solana pool data after launch
// TODO: Integrate Birdeye API or Helius DAS for live pool balances/prices
const poolData = [
  {
    address: "VOID_SOL_POOL_ADDRESS",
    name: "VOID/SOL",
    totalValue: 50000,
    voidBalance: "50000000",
    secondTokenBalance: "100",
    voidValue: 25000,
    secondTokenValue: 25000,
    secondToken: { symbol: "SOL", decimals: 9 }
  },
];

const VoidExplorer = () => {
  const mountRef = useRef(null);
  const [selectedPool, setSelectedPool] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [isExrLoaded, setIsExrLoaded] = useState(false);

  useEffect(() => {
    let scene, camera, renderer, composer, controls, voidSphere, poolGroup;
    let animationFrameId;

    const init = async () => {
      setLoadingProgress(0);

      scene = new THREE.Scene();
      camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
      renderer = new THREE.WebGLRenderer({ antialias: true });
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1;
      renderer.outputColorSpace = THREE.SRGBColorSpace;

      renderer.setSize(window.innerWidth, window.innerHeight);
      mountRef.current.appendChild(renderer.domElement);

      const exrLoader = new EXRLoader();
      exrLoader.load(
        'sky.exr',
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          scene.background = texture;
          scene.environment = texture;
          setIsExrLoaded(true);
        },
        undefined,
        (error) => {
          console.error('Error loading EXR:', error);
          // Fallback: dark background
          scene.background = new THREE.Color(0x050508);
          setIsExrLoaded(true);
        }
      );

      composer = new EffectComposer(renderer);
      const renderPass = new RenderPass(scene, camera);
      composer.addPass(renderPass);

      const bloomPass = new UnrealBloomPass(
        new THREE.Vector2(window.innerWidth, window.innerHeight),
        0.6,   // intensity — slightly higher for purple glow
        0.3,
        0.75
      );
      composer.addPass(bloomPass);

      const ambientLight = new THREE.AmbientLight(0x404040, 0.5);
      scene.add(ambientLight);

      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.5);
      directionalLight.position.set(1, 1, 1);
      scene.add(directionalLight);

      // Purple point light for atmosphere
      const purpleLight = new THREE.PointLight(0x9B30FF, 0.3, 200);
      purpleLight.position.set(0, 0, 0);
      scene.add(purpleLight);

      camera.position.z = 150;
      controls = new OrbitControls(camera, renderer.domElement);

      setLoadingProgress(50);
      createObjects(poolData);
      setLoadingProgress(100);

      window.addEventListener('resize', handleResize);
      window.addEventListener('click', onMouseClick);

      animate();
    };

    const createObjects = (pools) => {
      const mainPool = pools.find(pool => pool.name === 'VOID/SOL') || pools[0];
      const centralSphereSize = 28;

      // Central VOID sphere with purple shader
      const voidGeometry = new THREE.SphereGeometry(centralSphereSize, 32, 32);
      const voidMaterial = new THREE.ShaderMaterial({
        uniforms: {
          time: { value: 0 },
        },
        vertexShader: `
          varying vec2 vUv; 
          void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          }
        `,
        fragmentShader: `
          uniform float time;
          varying vec2 vUv;
          
          float noise(vec2 p) {
            return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
          }
          
          void main() {
            vec2 uv = vUv;
            float n = noise(uv * 5.0 + time * 0.1);
            vec3 color = mix(vec3(0.05, 0.0, 0.12), vec3(0.38, 0.0, 1.0), n);
            float alpha = smoothstep(0.6, 0.2, length(uv - 0.5));
            gl_FragColor = vec4(color, alpha * 0.6);
          }
        `,
        transparent: true,
        blending: THREE.AdditiveBlending,
      });

      voidSphere = new THREE.Mesh(voidGeometry, voidMaterial);
      voidSphere.userData = mainPool;
      scene.add(voidSphere);

      // Side pool spheres
      poolGroup = new THREE.Group();
      scene.add(poolGroup);

      const sidePools = pools.filter(pool => pool.name !== 'VOID/SOL');

      sidePools.forEach((pool) => {
        const poolSize = 6;
        const poolGeometry = new THREE.SphereGeometry(poolSize, 32, 32);
        const poolMaterial = new THREE.MeshStandardMaterial({
          color: 0x9B30FF,
          emissive: 0x4B0082,
          emissiveIntensity: 0.3,
          roughness: 0.4,
          metalness: 0.6
        });
        const poolSphere = new THREE.Mesh(poolGeometry, poolMaterial);

        const distance = centralSphereSize + poolSize + 30 + Math.random() * 60;
        const angle1 = Math.random() * Math.PI * 2;
        const angle2 = Math.random() * Math.PI * 2;
        poolSphere.position.set(
          distance * Math.sin(angle1) * Math.cos(angle2),
          distance * Math.sin(angle1) * Math.sin(angle2),
          distance * Math.cos(angle1)
        );

        poolSphere.userData = pool;
        poolGroup.add(poolSphere);
      });
    };

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
      composer.setSize(window.innerWidth, window.innerHeight);
    };

    const onMouseClick = (event) => {
      const mouse = new THREE.Vector2(
        (event.clientX / window.innerWidth) * 2 - 1,
        -(event.clientY / window.innerHeight) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);
      const allObjects = [voidSphere, ...(poolGroup ? poolGroup.children : [])];
      const intersects = raycaster.intersectObjects(allObjects);

      if (intersects.length > 0) {
        setSelectedPool(intersects[0].object.userData);
      } else {
        setSelectedPool(null);
      }
    };

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      if (poolGroup) {
        poolGroup.rotation.y += 0.001;
        poolGroup.children.forEach(pool => {
          pool.rotation.y += 0.01;
        });
      }
      if (voidSphere) {
        voidSphere.rotation.y += 0.001;
        voidSphere.material.uniforms.time.value += 0.01;
      }
      controls.update();
      composer.render();
    };

    init();

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('click', onMouseClick);
      cancelAnimationFrame(animationFrameId);
      if (mountRef.current && renderer) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, []);

  useEffect(() => {
    if (isExrLoaded) {
      setIsLoading(false);
    }
  }, [isExrLoaded]);

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', position: 'relative' }}>
      {isLoading && <LoadingScreen progress={loadingProgress} />}
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />
      {selectedPool && (
        <div style={{
          position: 'absolute',
          top: '10px',
          left: '10px',
          background: 'rgba(5, 5, 8, 0.85)',
          backdropFilter: 'blur(12px)',
          color: 'white',
          padding: '16px',
          borderRadius: '12px',
          border: '1px solid rgba(155, 48, 255, 0.15)',
          fontFamily: "'Space Grotesk', sans-serif",
          maxWidth: '300px'
        }}>
          <h3 style={{ color: '#b44aff', marginTop: 0 }}>{selectedPool.name}</h3>
          <p style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.5)' }}>
            {selectedPool.address}
          </p>
          <p>Total Value: <span style={{ color: '#d68fff' }}>${selectedPool.totalValue?.toLocaleString() || '—'}</span></p>
        </div>
      )}
    </div>
  );
};

export default VoidExplorer;