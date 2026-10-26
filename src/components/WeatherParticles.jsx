import React, { useEffect, useRef } from 'react';

/**
 * 3D 지도 전용 고성능 비·눈 날씨 시각화 파티클 캔버스
 * - 비: 바람 각도, 속도감 있는 빗줄기 스트로크, 지면 수면 스플래시 리플, 빗방울 안개 분위기
 * - 눈: 흔들리는 사인파 드리프트 눈송이, 몽환적인 겨울 대기 효과
 * - 지도 클릭·패닝 등 상호작용 완전 투과 (pointer-events: none)
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
    let width = (canvas.width = canvas.parentElement?.clientWidth || window.innerWidth);
    let height = (canvas.height = canvas.parentElement?.clientHeight || window.innerHeight);

    const handleResize = () => {
      if (!canvas || !canvas.parentElement) return;
      width = canvas.width = canvas.parentElement.clientWidth;
      height = canvas.height = canvas.parentElement.clientHeight;
    };
    window.addEventListener('resize', handleResize);

    // 파티클 생성 수 (강도 반영)
    const rainCount = Math.min(280, Math.max(90, Math.round(150 * intensity)));
    const snowCount = Math.min(180, Math.max(60, Math.round(90 * intensity)));

    // 비 파티클
    const raindrops = Array.from({ length: rainCount }, () => ({
      x: Math.random() * (width + 200) - 100,
      y: Math.random() * height,
      len: 18 + Math.random() * 22,
      speed: 18 + Math.random() * 14,
      opacity: 0.18 + Math.random() * 0.45,
      width: 0.9 + Math.random() * 1.2
    }));

    // 빗방울 지면 착지 리플(Splash) 풀
    const ripples = [];
    const createRipple = (x, y) => {
      if (ripples.length < 35 && Math.random() > 0.45) {
        ripples.push({
          x,
          y,
          r: 1,
          maxR: 4 + Math.random() * 8,
          opacity: 0.4
        });
      }
    };

    // 눈 파티클
    const snowflakes = Array.from({ length: snowCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: 1.5 + Math.random() * 3.5,
      density: Math.random() * 30,
      speed: 0.7 + Math.random() * 1.6,
      opacity: 0.3 + Math.random() * 0.55,
      swing: Math.random() * Math.PI * 2
    }));

    let frame = 0;

    const render = () => {
      frame++;
      ctx.clearRect(0, 0, width, height);

      if (type === 'rain') {
        // 비 대기 분위기 (미세한 안개 틴트)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.08)';
        ctx.fillRect(0, 0, width, height);

        // 빗줄기 렌더링
        ctx.strokeStyle = '#bae6fd';
        ctx.lineCap = 'round';

        for (let i = 0; i < raindrops.length; i++) {
          const p = raindrops[i];
          ctx.beginPath();
          ctx.lineWidth = p.width;
          ctx.strokeStyle = `rgba(186, 230, 253, ${p.opacity})`;
          // -15도 살짝 기울어진 빗줄기
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 3.5, p.y + p.len);
          ctx.stroke();

          p.y += p.speed;
          p.x -= 2.2;

          // 바닥 부근 도달 시 리플 발생
          if (p.y > height - 120 && Math.random() > 0.7) {
            createRipple(p.x, p.y + p.len * 0.7);
          }

          if (p.y > height) {
            p.y = -p.len - Math.random() * 50;
            p.x = Math.random() * (width + 200) - 50;
          }
          if (p.x < -100) p.x = width + 50;
        }

        // 지면 착지 리플 렌더링
        for (let i = ripples.length - 1; i >= 0; i--) {
          const rip = ripples[i];
          ctx.beginPath();
          ctx.arc(rip.x, rip.y, rip.r, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(186, 230, 253, ${rip.opacity})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();

          rip.r += 0.8;
          rip.opacity -= 0.028;
          if (rip.opacity <= 0 || rip.r >= rip.maxR) {
            ripples.splice(i, 1);
          }
        }
      } else if (type === 'snow') {
        // 눈 내리는 겨울 틴트
        ctx.fillStyle = 'rgba(241, 245, 249, 0.04)';
        ctx.fillRect(0, 0, width, height);

        for (let i = 0; i < snowflakes.length; i++) {
          const s = snowflakes[i];
          ctx.beginPath();
          ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
          ctx.shadowBlur = 4;
          ctx.shadowColor = 'rgba(255, 255, 255, 0.6)';
          ctx.fill();
          ctx.shadowBlur = 0;

          s.swing += 0.02;
          s.x += Math.sin(s.swing) * 0.8;
          s.y += s.speed;

          if (s.y > height) {
            s.y = -10;
            s.x = Math.random() * width;
          }
          if (s.x > width + 10) s.x = -10;
          if (s.x < -10) s.x = width + 10;
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      if (animId) cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
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
