import React from "react";

const milliseconds = value => typeof value === "number" ? `${(value * 1000).toFixed(2)} ms` : "미제공";
const setting = value => value === undefined ? "미보고" : String(value);

export default function AudioPanel({ engine, diagnostics: d }) {
  const capture = (key, enabled) => engine.setCaptureSettings({ [key]: enabled });
  return (
    <section className="audio-panel" aria-label="오디오 안전 설정 및 진단">
      <div className="audio-panel-actions">
        <strong>마이크 안전 설정</strong>
        <button type="button" className="audio-mute" disabled={d.status !== "running" || d.muted} onClick={() => engine.emergencyMute()}>
          {d.muted ? "음소거됨 · 재시작 필요" : "긴급 MUTE"}
        </button>
      </div>
      <p>초기 게인 0.2는 시험 시작값입니다. 모든 환경에서 안전하지 않습니다. 유선 헤드폰으로 먼저 테스트하세요.</p>
      <div className="audio-panel-actions">
        <button type="button" onClick={() => engine.setCaptureSettings({ echoCancellation: true, noiseSuppression: true })}>하울링 억제 우선</button>
        <button type="button" onClick={() => engine.setCaptureSettings({ echoCancellation: false, noiseSuppression: false })}>음질 우선 · 헤드폰 권장</button>
      </div>
      {[['echoCancellation', '에코 제거(AEC)'], ['noiseSuppression', '잡음 억제']].map(([key, label]) => (
        <label key={key} className="audio-setting">
          <input type="checkbox" checked={d.requested[key]} disabled={!d.supported[key]} onChange={e => capture(key, e.target.checked)} />
          {label}: {d.supported[key] ? `요청 ${d.requested[key] ? 'ON' : 'OFF'} · 실제 ${setting(d.trackSettings[key])}` : '이 브라우저에서 미지원'}
        </label>
      ))}
      <p>설정 변경 시 마이크를 중단합니다. 다시 켠 뒤 실제 적용값을 비교하세요. AEC는 음색·음량에 영향을 줄 수 있습니다.</p>
      <label>최종 마이크 출력 <meter min="0" max="1" value={Math.min(1, d.level)} /> RMS {d.level.toFixed(3)} · Peak {d.peak.toFixed(3)}</label>
      <p role="status">{d.warning || '출력 레벨 보호 활성화 시 자동 감쇠합니다. 하울링 감지·완전 제거 기능은 아닙니다.'}</p>
      <details>
        <summary>오디오 진단 · {d.status} · {d.mode}</summary>
        <dl>
          <dt>AudioContext</dt><dd>{d.contextState}</dd>
          <dt>sampleRate</dt><dd>{d.sampleRate ?? '미제공'} Hz</dd>
          <dt>baseLatency</dt><dd>{milliseconds(d.baseLatency)}</dd>
          <dt>outputLatency</dt><dd>{milliseconds(d.outputLatency)}</dd>
          <dt>자동 게인(AGC) 실제값</dt><dd>{setting(d.trackSettings.autoGainControl)} (항상 OFF 요청)</dd>
          <dt>보호 감쇠</dt><dd>{d.protectionScale.toFixed(3)}배</dd>
          <dt>AudioWorklet</dt><dd>{d.status !== 'running' ? '시작 후 확인' : d.workletAvailable ? '사용 가능' : '미지원 · 기본 경로 사용'}</dd>
        </dl>
        <pre>{JSON.stringify(d.trackSettings, null, 2)}</pre>
        <p>장치 정보는 현재 화면에만 표시됩니다. baseLatency와 outputLatency는 전체 마이크→스피커 지연이 아닙니다. 왕복 지연 및 실제 하울링 개선: 미측정.</p>
        <p>현재 곡 진행은 기존 시연 타이머입니다. 실제 반주·음악 API는 실기기 검증 후 연동합니다.</p>
      </details>
    </section>
  );
}
