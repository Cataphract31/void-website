import React, { useEffect, useRef } from 'react';
import styled from 'styled-components';

const CanvasWrapper = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: -1;
  overflow: hidden;
  background: #030306;
`;

const Canvas = styled.canvas`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
`;

const Background = () => {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationId;
    let particles = [];
    let mouse = { x: null, y: null };
    let width, height, centerX, centerY;

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      centerX = width / 2;
      centerY = height * 0.35;
    };

    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        // Spawn from edges
        const side = Math.random();
        if (side < 0.25) {
          this.x = Math.random() * width;
          this.y = -10;
        } else if (side < 0.5) {
          this.x = Math.random() * width;
          this.y = height + 10;
        } else if (side < 0.75) {
          this.x = -10;
          this.y = Math.random() * height;
        } else {
          this.x = width + 10;
          this.y = Math.random() * height;
        }

        this.size = Math.random() * 2 + 0.5;
        this.speedX = 0;
        this.speedY = 0;
        this.opacity = Math.random() * 0.5 + 0.1;
        this.hue = 270 + Math.random() * 30; // purple range
        this.life = 1;
        this.decay = Math.random() * 0.001 + 0.0005;
      }

      update() {
        // Gravitational pull toward center vortex
        const dx = centerX - this.x;
        const dy = centerY - this.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const force = Math.min(0.15, 500 / (dist * dist));

        this.speedX += (dx / dist) * force;
        this.speedY += (dy / dist) * force;

        // Mouse interaction — push particles away
        if (mouse.x !== null) {
          const mdx = this.x - mouse.x;
          const mdy = this.y - mouse.y;
          const mDist = Math.sqrt(mdx * mdx + mdy * mdy);
          if (mDist < 120) {
            const mForce = (120 - mDist) / 120;
            this.speedX += (mdx / mDist) * mForce * 0.8;
            this.speedY += (mdy / mDist) * mForce * 0.8;
          }
        }

        // Damping
        this.speedX *= 0.98;
        this.speedY *= 0.98;

        this.x += this.speedX;
        this.y += this.speedY;
        this.life -= this.decay;

        // Absorb into vortex
        if (dist < 30 || this.life <= 0) {
          this.reset();
        }
      }

      draw(ctx) {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 80%, 65%, ${this.opacity * this.life})`;
        ctx.fill();

        // Glow
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 3, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${this.hue}, 80%, 65%, ${this.opacity * this.life * 0.15})`;
        ctx.fill();
      }
    }

    const init = () => {
      resize();
      particles = [];
      const count = Math.min(150, Math.floor((width * height) / 8000));
      for (let i = 0; i < count; i++) {
        const p = new Particle();
        // Scatter initial positions
        p.x = Math.random() * width;
        p.y = Math.random() * height;
        particles.push(p);
      }
    };

    const drawVortex = () => {
      // Core black hole
      const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 200);
      gradient.addColorStop(0, 'rgba(0, 0, 0, 1)');
      gradient.addColorStop(0.15, 'rgba(0, 0, 0, 0.95)');
      gradient.addColorStop(0.4, 'rgba(30, 0, 60, 0.15)');
      gradient.addColorStop(0.7, 'rgba(60, 0, 120, 0.03)');
      gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = gradient;
      ctx.fillRect(centerX - 200, centerY - 200, 400, 400);

      // Accretion glow ring
      ctx.beginPath();
      ctx.arc(centerX, centerY, 80, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(155, 48, 255, 0.04)';
      ctx.lineWidth = 30;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(centerX, centerY, 55, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(180, 74, 255, 0.03)';
      ctx.lineWidth = 15;
      ctx.stroke();
    };

    const drawConnections = () => {
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 80) {
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            const alpha = (1 - dist / 80) * 0.08;
            ctx.strokeStyle = `rgba(155, 48, 255, ${alpha})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }
    };

    const animate = () => {
      ctx.fillStyle = 'rgba(3, 3, 6, 0.15)';
      ctx.fillRect(0, 0, width, height);

      drawVortex();
      drawConnections();

      particles.forEach(p => {
        p.update();
        p.draw(ctx);
      });

      animationId = requestAnimationFrame(animate);
    };

    const handleMouse = (e) => {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    };

    const handleMouseOut = () => {
      mouse.x = null;
      mouse.y = null;
    };

    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', handleMouse);
    window.addEventListener('mouseout', handleMouseOut);

    init();
    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('mouseout', handleMouseOut);
    };
  }, []);

  return (
    <CanvasWrapper>
      <Canvas ref={canvasRef} />
    </CanvasWrapper>
  );
};

export default Background;