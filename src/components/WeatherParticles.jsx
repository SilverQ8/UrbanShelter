import React, { useEffect, useRef, useState } from 'react';

/**
 * 2D / 3D 지도 공용 고성능 비·눈 날씨 시각화 파티클 캔버스
 * - 다크 모드 / 라이트 모드 동적 색상 자동 감지 및 시인성 최적화
 *   * 다크 모드: 어두운 배경 대비 밝은 아이시 블루(186, 230, 253) / 순백 눈 결정
 *   * 라이트 모드: 밝은 지도 타일 대비 선명한 빗줄기(짙은 블루 29, 78, 216) & 눈 결정 테두리/음영
 * - 2D 모드 (is2D=true): 도로명, POI, 마커 가독성을 위해 적정 밀도와 은은한 파문 연출
 * - 3D 모드: 풍성한 빗줄기, 지면 스플래시 비드 및 타원형 물방울 파문
 * - 상호작용 완전 투과 (pointer-events: none)
 */
export default function WeatherParticles({
  type = null,
  intensity = 1.0,
  precipitation = 0,
  is2D = false,
  mapTheme = 'dark'
}) {
  const canvasRef = useRef(null);

  // 현재 라이트 모드 여부 감지 (prop 또는 document data-theme 속성 감지)
  const [isLight, setIsLight] = useState(() => {
    if (mapTheme === 'light') return true;
    if (typeof document !== 'undefined') {
      return document.documentElement.getAttribute('data-theme') === 'light';
    }
    return false;
  });

  // mapTheme prop 또는 data-theme 속성 변경 실시간 관찰
  useEffect(() => {
    const updateTheme = () => {
      const docTheme =
        typeof document !== 'undefined'
          ? document.documentElement.getAttribute('data-theme')
          : null;
      setIsLight(mapTheme === 'light' || docTheme === 'light');
    };

    updateTheme();

    if (typeof document !== 'undefined') {
      const observer = new MutationObserver(updateTheme);
      observer.observe(document.documentElement, {
        attributes: true,
        attributeFilter: ['data-theme']
      });
      return () => observer.disconnect();
    }
  }, [mapTheme]);

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
      cssWidth = canvas.parentElement?.clientWidth || window.innerWidth;
      cssHeight = canvas.parentElement?.clientHeight || window.innerHeight;
      dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(cssWidth * dpr);
      canvas.height = Math.round(cssHeight * dpr);
    };
    resize();
    window.addEventListener('resize', resize);

    // 비 세기: 강수량 0.5mm(가랑비)=0 ~ 6mm 이상(폭우)=1 로 환산한다. 값이 없으면 보통 비(2mm)로 본다.
    const rainMm = precipitation > 0 ? precipitation : 2;
    const level = Math.min(1, Math.max(0, (rainMm - 0.5) / 5.5));
    // 2D는 지도 글자·도로가 배경이라 약한 비도 눈에 띄도록 하한을 높인다.
    const rainCount = is2D
      ? Math.round(32 + 58 * level)
      : Math.round(40 + 280 * level);
    const speedMul = 0.65 + 0.55 * level; // 가랑비는 느리게, 폭우는 빠르게
    const widthMul = is2D ? 1.0 + 0.5 * level : 0.7 + 0.6 * level; // 가랑비는 가늘게, 폭우는 굵게
    const lenMul = is2D ? 0.9 + 0.35 * level : 0.75 + 0.5 * level;
    const opacityMul = is2D ? 1.5 + 0.2 * level : 0.75 + 0.35 * level;

    const snowCount = is2D
      ? Math.min(55, Math.max(25, Math.round(40 * intensity)))
      : Math.min(160, Math.max(65, Math.round(90 * intensity)));

    // [1] 비 파티클 (라이트 모드에서는 또렷한 굵기와 농도로 시인성 확보)
    const raindrops = Array.from({ length: rainCount }, () => ({
      x: Math.random() * (cssWidth + 200) - 100,
      y: Math.random() * cssHeight,
      len: lenMul * (is2D
        ? isLight ? 16 + Math.random() * 16 : 14 + Math.random() * 14
        : 22 + Math.random() * 26),
      speed: speedMul * (is2D ? 16 + Math.random() * 10 : 24 + Math.random() * 16),
      opacity: Math.min(1, opacityMul * (is2D
        ? isLight ? 0.38 + Math.random() * 0.35 : 0.18 + Math.random() * 0.25
        : isLight ? 0.45 + Math.random() * 0.45 : 0.25 + Math.random() * 0.5)),
      width: widthMul * (is2D
        ? isLight ? 1.2 + Math.random() * 0.6 : 0.85 + Math.random() * 0.5
        : isLight ? 1.4 + Math.random() * 1.0 : 1.0 + Math.random() * 1.4)
    }));

    // 빗방울 바닥 스플래시
    const ripples = [];
    const splashBeads = [];

    const triggerSplash = (x, y) => {
      if (is2D) {
        if (ripples.length < 16 && Math.random() > 0.5) {
          ripples.push({
            x,
            y,
            rx: 1.0,
            ry: 0.4,
            maxRx: isLight ? 4.5 + Math.random() * 5.0 : 3.5 + Math.random() * 4.5,
            opacity: isLight ? 0.45 : 0.28
          });
        }
        return;
      }

      // 3D 모드 지면 스플래시
      if (ripples.length < 40 && Math.random() > 0.35) {
        ripples.push({
          x,
          y,
          rx: 1.5,
          ry: 0.6,
          maxRx: 7 + Math.random() * 10,
          opacity: isLight ? 0.55 : 0.45
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

    // [2] 눈 파티클
    const snowflakes = Array.from({ length: snowCount }, () => {
      const isCrystal = is2D ? Math.random() > 0.75 : Math.random() > 0.6;
      const size = isCrystal
        ? is2D ? 3.0 + Math.random() * 3.0 : 4.5 + Math.random() * 5.5
        : is2D ? 1.8 + Math.random() * 2.5 : 2.0 + Math.random() * 5.0;

      return {
        x: Math.random() * cssWidth,
        y: Math.random() * cssHeight,
        size,
        isCrystal,
        speed: is2D ? 0.6 + Math.random() * 0.9 : 0.8 + Math.random() * 1.4,
        swing: Math.random() * Math.PI * 2,
        swingSpeed: 0.015 + Math.random() * 0.02,
        swingRadius: is2D ? 0.5 + Math.random() * 0.9 : 0.8 + Math.random() * 1.5,
        rotation: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.03,
        opacity: isLight ? 0.45 + Math.random() * 0.4 : 0.25 + Math.random() * 0.45
      };
    });

    // 6각 눈 결정체 그리기 헬퍼
    const drawCrystal = (c, x, y, size, rot, opacity) => {
      c.save();
      c.translate(x, y);
      c.rotate(rot);

      // 라이트 모드에서는 밝은 배경에서도 잘 보이도록 선명한 코발트/블루 톤 적용
      c.strokeStyle = isLight
        ? `rgba(37, 99, 235, ${opacity * 0.85})`
        : `rgba(255, 255, 255, ${opacity})`;
      c.lineWidth = is2D ? (isLight ? 1.1 : 0.75) : (isLight ? 1.4 : 1.1);
      c.lineCap = 'round';

      for (let j = 0; j < 3; j++) {
        c.beginPath();
        c.moveTo(-size, 0);
        c.lineTo(size, 0);
        c.stroke();

        const branchLen = size * 0.35;
        const branchOffset = size * 0.55;

        c.beginPath();
        c.moveTo(branchOffset, 0);
        c.lineTo(branchOffset + branchLen * 0.6, -branchLen);
        c.moveTo(branchOffset, 0);
        c.lineTo(branchOffset + branchLen * 0.6, branchLen);

        c.moveTo(-branchOffset, 0);
        c.lineTo(-branchOffset - branchLen * 0.6, -branchLen);
        c.moveTo(-branchOffset, 0);
        c.lineTo(-branchOffset - branchLen * 0.6, branchLen);
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
        // [비] 날씨 배경 틴트
        if (isLight) {
          // 라이트 모드: 흐리고 촉촉한 비오는 날 분위기 (은은한 쿨 슬레이트 틴트)
          ctx.fillStyle = is2D ? 'rgba(71, 85, 105, 0.035)' : 'rgba(71, 85, 105, 0.06)';
        } else {
          // 다크 모드: 깊은 밤비 틴트
          ctx.fillStyle = is2D ? 'rgba(15, 23, 42, 0.015)' : 'rgba(15, 23, 42, 0.06)';
        }
        ctx.fillRect(0, 0, cssWidth, cssHeight);

        // 빗줄기 색상 (라이트 모드: 선명한 비 색상, 다크 모드: 빛나는 아이시 블루)
        const rainColorRgb = isLight ? '29, 78, 216' : '186, 230, 253';

        // 빗줄기 렌더링
        ctx.lineCap = 'round';
        for (let i = 0; i < raindrops.length; i++) {
          const p = raindrops[i];
          ctx.beginPath();
          ctx.lineWidth = p.width;
          ctx.strokeStyle = `rgba(${rainColorRgb}, ${p.opacity})`;
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - 3.8, p.y + p.len);
          ctx.stroke();

          p.y += p.speed;
          p.x -= 2.6;

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

        // 바닥 물 튀김 비드 (3D 전용)
        if (!is2D) {
          for (let i = splashBeads.length - 1; i >= 0; i--) {
            const b = splashBeads[i];
            ctx.beginPath();
            ctx.arc(b.x, b.y, 1.2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${rainColorRgb}, ${b.life * 0.75})`;
            ctx.fill();

            b.x += b.vx;
            b.y += b.vy;
            b.vy += b.gravity;
            b.life -= b.decay;
            if (b.life <= 0) splashBeads.splice(i, 1);
          }
        }

        // 지면 착지 원근 파문 (타원형)
        for (let i = ripples.length - 1; i >= 0; i--) {
          const rip = ripples[i];
          ctx.beginPath();
          ctx.ellipse(rip.x, rip.y, rip.rx, rip.ry, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(${rainColorRgb}, ${rip.opacity * (is2D ? 0.65 : 0.75)})`;
          ctx.lineWidth = is2D ? (isLight ? 1.1 : 0.8) : (isLight ? 1.3 : 1.0);
          ctx.stroke();

          rip.rx += is2D ? 0.65 : 0.9;
          rip.ry += is2D ? 0.26 : 0.36;
          rip.opacity -= is2D ? 0.03 : 0.024;
          if (rip.opacity <= 0 || rip.rx >= rip.maxRx) {
            ripples.splice(i, 1);
          }
        }
      } else if (type === 'snow') {
        // [눈] 하늘 틴트
        ctx.fillStyle = isLight
          ? is2D ? 'rgba(186, 230, 253, 0.04)' : 'rgba(186, 230, 253, 0.08)'
          : is2D ? 'rgba(224, 242, 254, 0.015)' : 'rgba(224, 242, 254, 0.04)';
        ctx.fillRect(0, 0, cssWidth, cssHeight);

        for (let i = 0; i < snowflakes.length; i++) {
          const s = snowflakes[i];
          s.swing += s.swingSpeed;
          s.rotation += s.rotSpeed;
          s.x += Math.sin(s.swing) * s.swingRadius;
          s.y += s.speed;

          if (s.isCrystal) {
            drawCrystal(ctx, s.x, s.y, s.size, s.rotation, s.opacity);
          } else {
            ctx.save();
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, Math.PI * 2);

            if (isLight) {
              // 라이트 모드: 하얀 눈송이에 쿨 블루 테두리와 음영으로 또렷한 시인성 부여
              ctx.fillStyle = `rgba(240, 249, 255, ${s.opacity})`;
              ctx.strokeStyle = `rgba(37, 99, 235, ${s.opacity * 0.7})`;
              ctx.lineWidth = 0.8;
              ctx.shadowBlur = 4;
              ctx.shadowColor = 'rgba(59, 130, 246, 0.5)';
              ctx.fill();
              ctx.stroke();
            } else {
              // 다크 모드: 몽글몽글 빛나는 순백 눈송이
              ctx.fillStyle = `rgba(255, 255, 255, ${s.opacity})`;
              ctx.shadowBlur = is2D ? 3 : 6;
              ctx.shadowColor = 'rgba(224, 242, 254, 0.9)';
              ctx.fill();
            }
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
  }, [type, intensity, precipitation, is2D, isLight]);

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
        zIndex: is2D ? 450 : 10
      }}
    />
  );
}
