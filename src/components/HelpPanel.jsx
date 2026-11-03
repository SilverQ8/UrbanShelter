import React from 'react';
import { X, Compass, Sun, Moon, Car, CloudSun, MapPin, Palette } from 'lucide-react';

// 화면에 길게 쓰던 설명을 모아 둔 사용 안내. 헤더의 ? 아이콘으로 연다.
const ITEMS = [
  { icon: Compass, color: '#a1a1aa', title: '가장 짧은 길', text: '걸어서 갈 수 있는 가장 짧은 보행 경로예요.' },
  { icon: Sun, color: '#f59e0b', title: '폭염 그늘', text: '현재 태양 위치와 건물 그림자를 분석해 그늘이 많은 길로 안내해요. 한여름 한낮에 추천해요.' },
  { icon: Moon, color: '#6ee7b0', title: '야간 안심', text: 'CCTV와 가로등 공공데이터를 바탕으로 밝고 안전한 길을 우선해요. 밤에 추천해요.' },
  { icon: Car, color: '#38bdf8', title: '차량 기준', text: '자동차가 다닐 수 있는 도로를 따라가요. 걸어갈 때는 설정에서 도보로 바꿔 주세요.' },
  { icon: CloudSun, color: '#a78bfa', title: '자동 안내', text: '날씨와 시간에 따라 알맞은 경로 방식을 자동으로 골라요. 설정에서 직접 고를 수도 있어요.' },
  { icon: MapPin, color: '#f43f5e', title: '주변 장소', text: '병원, 약국, 편의점 등 시설을 지도에 표시해요. 현재 지역 중심 약 600m(경로가 있으면 경로 주변 약 450m) 기준이에요.' },
  { icon: Palette, color: '#34d399', title: '지도 색', text: '경로의 초록은 시원한 그늘 구간, 주황은 직사광선 구간이에요.' }
];

export default function HelpPanel({ onClose }) {
  return (
    <div className="onboarding-backdrop" role="dialog" aria-modal="true" aria-labelledby="help-title" onClick={onClose}>
      <div className="onboarding-card glass-panel settings-card" onClick={(e) => e.stopPropagation()}>
        <div className="settings-head">
          <h2 id="help-title" className="onboarding-title" style={{ marginBottom: 0 }}>사용 안내</h2>
          <button type="button" className="settings-close" onClick={onClose} aria-label="안내 닫기" title="닫기">
            <X size={22} />
          </button>
        </div>
        <ul className="help-list">
          {ITEMS.map(({ icon: Icon, color, title, text }) => (
            <li key={title} className="help-item">
              <span className="help-icon" style={{ color }}><Icon size={18} /></span>
              <div><strong>{title}</strong><p>{text}</p></div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
