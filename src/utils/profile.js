// 이용자 맞춤 설정: 첫 실행 시 고른 "필요한 도움"을 기기(localStorage)에만 저장한다.
// 서버로 전송하지 않으며, 건강·이동 관련 정보라 다른 곳에 연결하지 않는다.

const STORAGE_KEY = 'urbanshelter.profile.v1';

export const NEED_OPTIONS = [
  {
    id: 'slow',
    label: '천천히 걸어요',
    desc: '소요 시간을 느린 걸음(약 3km/h) 기준으로 계산해요',
    available: true
  },
  {
    id: 'largeText',
    label: '글씨를 크게 보고 싶어요',
    desc: '화면의 글자를 더 크게 보여줘요',
    available: true
  },
  {
    id: 'night',
    label: '밤길이 불안해요',
    desc: '야간 안심(CCTV) 경로를 먼저 보여줘요',
    available: true
  },
  {
    id: 'barrierFree',
    label: '계단·급경사를 피해야 해요',
    desc: '휠체어·유모차 이용자를 위한 무단차 경로 (준비 중)',
    available: false
  }
];

export const DEFAULT_WALK_SPEED = 75; // m/분 (약 4.5km/h)
export const SLOW_WALK_SPEED = 50; // m/분 (약 3.0km/h)

export function loadProfile() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.needs)) return null;
    return { needs: parsed.needs };
  } catch {
    return null;
  }
}

export function saveProfile(profile) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // 저장소를 쓸 수 없는 환경이어도 현재 세션에서는 설정이 적용된다.
  }
}

export function getWalkSpeed(needs) {
  return needs.includes('slow') ? SLOW_WALK_SPEED : DEFAULT_WALK_SPEED;
}

export function getDefaultMode(needs) {
  return needs.includes('night') ? 'night' : 'shade';
}
