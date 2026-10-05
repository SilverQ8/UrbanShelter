// Web Speech API 기반 브라우저 내장 한국어 음성 안내 (TTS) 서비스
// 별도 라이브러리 없이 100% 브라우저 순수 음성 합성 지원

let ttsEnabled = true;
let selectedVoice = null;

// 한국어 음성(ko-KR) 초기화
function initVoice() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  const voices = window.speechSynthesis.getVoices();
  selectedVoice = voices.find(v => v.lang.includes('ko') || v.lang.includes('KO')) || null;
}

if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  window.speechSynthesis.onvoiceschanged = initVoice;
  initVoice();
}

/**
 * 텍스트를 한국어 음성으로 출력
 * @param {string} text - 읽어줄 안내 문구
 * @param {Object} [options] - 옵션 (rate: 속도, pitch: 톤)
 */
export function speakGuide(text, options = {}) {
  if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) return;
  if (!text || !text.trim()) return;

  try {
    window.speechSynthesis.cancel(); // 이전 음성 중단하고 최신 안내 우선 출력

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = 'ko-KR';
    utterance.rate = options.rate || 1.05; // 살짝 경쾌한 도보 안내 속도
    utterance.pitch = options.pitch || 1.0;
    
    if (selectedVoice) {
      utterance.voice = selectedVoice;
    }

    window.speechSynthesis.speak(utterance);
  } catch (err) {
    console.warn('TTS 음성 안내 오류:', err);
  }
}

/**
 * 음성 안내 ON/OFF 상태 토글
 * @returns {boolean} 변경된 상태
 */
export function toggleTts() {
  ttsEnabled = !ttsEnabled;
  if (!ttsEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
  return ttsEnabled;
}

export function isTtsEnabled() {
  return ttsEnabled;
}

export function setTtsEnabled(enabled) {
  ttsEnabled = Boolean(enabled);
  if (!ttsEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}
