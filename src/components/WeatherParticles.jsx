import React, { useEffect, useRef } from 'react';

/**
 * 3D 지도 전용 고성능 비·눈 날씨 시각화 파티클 캔버스
 * - 비 (Rain): 강한 속도감의 사선 빗줄기(스트로크), 바닥 지면 물 튀김(Splash) 및 타원형 원근 파문(Ripple), 흐린 빗길 분위기
 * - 눈 (Snow): 천천히 흩날리는 6각 눈 결정체(Crystalline Snowflake)와 몽글몽글한 함박눈(Soft Puff), 부드러운 회전 및 사인파 바람 흔들림
 * - 상호작용 완전 투과 (pointer-events: none)
 */
export default function WeatherParticles({ type = null, intensity = 1.0 }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    if (!type || (type !== 'rain' && type !== 'snow')) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId = null;
    let dpr = window.devicePixelRatio || 1;
    let cssWidth = canvas.parentElement?.clientWidth || window.innerWidth;
    let cssHeight = canvas.parentElement?.clientHeight || window.innerHeight;

    const resize = () => {
      if (!canvas || !canvas.parentElement) return;
      cssWidth = canvas.parentElement.clientWidth;
      cssHeight = canvas.parentElement.clientHeight;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // 파티클 수량
    const rainCount = Math.min(320, Math.max(120, Math.round(180 * intensity)));
    const snowCount = Math.min(160, Math.max(65, Math.round(90 * intensity)));

    // [1] 비 파티클 (빠른 속도, 날카로운 사선 스트로크)
    const raindrops = Array.from({ length: rainCount }, () => ({
      x: Math.random() * (cssWidth + 200) - 100,
      y: Math.random() * cssHeight,
      len: 22 + Math.random() * 26,
      speed: 24 + Math.random() * 16,
      opacity: 0.25 + Math.random() * 0.5,
      width: 1.0 + Math.random() * 1.4
    }));

    // 빗방울 바닥 스플래시 (물 튀김 비드 & 타원형 파문)
    const ripples = [];
    const splashBeads = [];

    const triggerSplash = (x, y) => {
      if (ripples.length < 40 && Math.random() > 0.35) {
        ripples.push({
          x,
          y,
          rx: 1.5,
          ry: 0.6,
          maxRx: 7 + Math.random() * 10,
          opacity: 0.45
        });
      }
      if (splashBeads.length < 30 && Math.random() > 0.6) {
        for (let i = 0; i < 2; i++) {
          splashBeads.push({
            x,
            y,
            vx: (Math.random() - 0.5) * 2.2,
            vy: -(1.5 + Math.random() * 2.5),
            gravity: 0.16,
            life: 1.0,
            decay: 0.05 + Math.random() * 0.03
          });
        }
      }
    };

    // [2] 눈 파티클 (천천히 흩날리는 결정체 & 함박눈)
    const snowflakes = Array.from({ length: snowCount }, () => {
      const isCrystal = Math.random() > 0.6; // 40%는 정교한 6각 눈 결정체
      const size = isCrystal ? 4.5 + Math.random() * 5.5 : 2.0 + Math.random() * 5.0;
      return {
        x: Math.random() * cssWidth,
        y: Math.random() * cssHeight,
        size,
        isCrystal,
        speed: 0.8 + Math.random() * 1.4, // 비보다 15~20배 천천히 하강
        swing: Math.random() * Math.PI * 2,
        swingSpeed: 0.015 + Math.random() * 0.02,
        swingRadius: 0.8 + Math.random() * 1.5,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.03,
        opacity: 0.35 + Math.random() * 0.55
      };
    });

    // 6각 눈 결정체 그리기 헬퍼
    const drawCrystal = (c, x, y, size, rot, opacity) => {
      c.save();
      c.translate(x, y);
      c.rotate(rot);
      c.strokeStyle = `rgba(255, 255, 255, ${opacity})`;
      c.lineWidth = size > 6 ? 1.6 : 1.1;
      c.lineCap = 'round';

      for (let arm = 0; arm < 3; arm++) {
        c.beginPath();
        c.moveTo(-size, 0);
        c.lineTo(size, 0);
        c.stroke();

        // 곁가지 (V자 바늘)
        const branchDist = size * 0.55;
        const branchLen = size * 0.32;
        c.beginPath();
        c.moveTo(branchDist - branchLen * 0.7, -branchLen);
        c.lineTo(branchDist, 0);
        c.lineTo(branchDist - branchLen * 0.7, branchLen);

        c.moveTo(-branchDist + branchLen * 0.7, -branchLen);
        c.lineTo(-branchDist, 0);
        c.lineTo(-branchDist + branchLen * 0.7, branchLen);
        c.stroke();

        c.rotate(Math.PI / 3);
      }
      c.restore();
    };

    const render = () => {
      ctx.save();
      ctx.scale(dpr, dpr);
      ctx.clearRect(0, 0, cssWidth, cssHeight);

      if (type === 'rain') {
        // [비] 살짝 어둡고 시원한 빗길 틴트
        ctx.fillStyle = 'rgba(15, 23, 42, 0.06)';
        ctx.fillRect(0, 0, cssWidth, cssHeight);

        // 빗줄기 (바람 각도 약 -18도)
        ctx.lineCap = 'round';
        for (let i = 0; i < raindrops.length; i++) {
          const p = raindrops[i];
          ctx.beginPath();
          ctx.lineWidth = p.width;
          ctx.strokeStyle = `rgba(186, 230, 253, ${p.opacity})`;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 4.5, p.y + p.len);
          ctx.stroke();

          p.y += p.speed;
          p.x -= 3.2;

          // 지면 부근 착지 시 물 튀김
          if (p.y > cssHeight - 100 && Math.random() > 0.65) {
            triggerSplash(p.x, p.y + p.len * 0.6);
          }

          if (p.y > cssHeight) {
            p.y = -p.len - Math.random() * 40;
            p.x = Math.random() * (cssWidth + 200) - 50;
          }
          if (p.x < -100) p.x = cssWidth + 50;
        }

        // 바닥 물 튀김 비드
        for (let i = splashBeads.length - 1; i >= 0; i--) {
          const b = splashBeads[i];
          ctx.beginPath();
          ctx.arc(b.x, b.y, 1.2, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(186, 230, 253, ${b.life * 0.7})`;
          ctx.fill();

          b.x += b.vx;
          b.y += b.vy;
          b.vy += b.gravity;
          b.life -= b.decay;
          if (b.life <= 0) splashBeads.splice(i, 1);
        }

        // 지면 착지 원근 파문 (타원형)
        for (let i = ripples.length - 1; i >= 0; i--) {
          const rip = ripples[i];
          ctx.beginPath();
          ctx.ellipse(rip.x, rip.y, rip.rx, rip.ry, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(186, 230, 253, ${rip.opacity * 0.6})`;
          ctx.lineWidth = 0.9;
          ctx.stroke();

          rip.rx += 0.9;
          rip.ry += 0.36;
          rip.opacity -= 0.024;
          if (rip.opacity <= 0 || rip.rx >= rip.maxRx) {
            ripples.splice(i, 1);
          }
        }
      } else if (type === 'snow') {
        // [눈] 화사하고 맑은 겨울 하늘 틴트
        ctx.fillStyle = 'rgba(224, 242, 254, 0.04)';
        ctx.fillRect(0, 0, cssWidth, cssHeight);

        for (let i = 0; i < snowflakes.length; i++) {
          const s = snowflakes[i];
          s.swing += s.swingSpeed;
          s.rotation += s.rotSpeed;
          s.x += Math.sin(s.swing) * s.swingRadius;
          s.y += s.speed;

          if (s.isCrystal) {
            // 정교한 6각 눈 결정체
            drawCrystal(ctx, s.x, s.y, s.size, s.rotation, s.opacity);
          } else {
            // 부드러운 함박눈 솜송이 (Soft Puff with Glow)
            ctx.save();
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
            ctx.shadowBlur = 6;
            ctx.shadowColor = 'rgba(224, 242, 254, 0.9)';
            ctx.fill();
            ctx.restore();
          }

          if (s.y > cssHeight + 15) {
            s.y = -15;
            s.x = Math.random() * cssWidth;
          }
          if (s.x > cssWidth + 20) s.x = -20;
          if (s.x < -20) s.x = cssWidth + 20;
        }
      }

      ctx.restore();
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, [type, intensity]);

  if (!type || (type !== 'rain' && type !== 'snow')) return null;

  return (
    <canvas
      ref={canvasRef}
      className="weather-particles-canvas"
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 5
      }}
    />
  );
}
