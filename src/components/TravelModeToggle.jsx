import React from 'react';
import { Footprints, Car } from 'lucide-react';

const OPTIONS = [
  { id: 'foot', label: '도보 (보도 기준)', icon: Footprints },
  { id: 'car', label: '차량', icon: Car }
];

export default function TravelModeToggle({ travelMode, setTravelMode }) {
  return (
    <div className="travel-toggle" role="group" aria-label="이동 수단">
      {OPTIONS.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={travelMode === id ? 'active' : ''}
          aria-pressed={travelMode === id}
          aria-label={label}
          title={label}
          onClick={() => setTravelMode(id)}
        >
          <Icon size={22} />
        </button>
      ))}
    </div>
  );
}
