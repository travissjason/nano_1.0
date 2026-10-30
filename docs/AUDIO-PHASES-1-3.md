# NANO PHASE 1–3: 구현 및 검증 기록

상태: 코드 구현·자동 검증 완료. 실제 장치의 하울링/왕복 지연 비교는 미측정.
음악 API 및 실제 반주 재생(PHASE 5)은 이 비교를 통과할 때까지 보류한다.

## 복원 지점 및 PHASE 1 분석

GitHub 복원 커밋: `b12efa791367d573e644d1f862c2e61248ae9311`.
원본 첨부 소스를 로컬 Git에 먼저 커밋한 뒤 수정했다.

기존 마이크 경로:

```text
getUserMedia(AEC OFF, NS OFF, AGC OFF, latency: 0 요청)
→ HPF 85 Hz → Compressor → ScriptProcessor(1024 samples, 항상 연결)
→ MicGain(초기 85% × 1.5 = 1.275)
  ├─ Destination
  ├─ Meter
  └─ WetSend 0.78 → Delay 110 ms ↔ Feedback 0.32
                     → Convolver 2.4 s → Lowpass → Destination
```

- AudioContext는 이미 `latencyHint: interactive`였다. `latency: 0` 요청이 실제 무지연을 보장하지 않는다.
- 오토튠 OFF도 메인 스레드 ScriptProcessor를 통과했다. ON에서는 28 ms 그레인 창을 추가 사용했다. 버퍼 길이는 실제 왕복 지연 측정치가 아니다.
- Dry/Wet 공통의 최종 출력 보호가 없었고 에코 피드백과 높은 초기 게인이 음향 피드백 위험을 높였다.
- 시작을 연타하면 권한 요청과 스트림이 중복될 수 있었다. 권한 대기 중 화면 이탈, 초기화 중 예외에서 로컬 리소스가 남을 수 있었다.
- 곡 진행은 타이머 기반 가상 재생이다. 실제 음악 소스나 독립 음악 오디오 노드는 없었다.

원인별 변경: ScriptProcessor 제거/선택 DSP 분리, 초기 게인 축소, Wet 피드백 제거, 최종 보호, 비동기 시작 취소 및 중복 방지. 다음 구조로 적용했다.

## PHASE 2–3 구조

```text
Mic → HPF 85 Hz → Dry Gain ──────────────────────┐
               └─ [오토튠 ON만] AudioWorklet → Tuned Gain
                                                ↓
                                           MicGain(0.2 시작)
                                                ├───────────┐
                                                └─ Convolver 0.65 s → Wet Gain(ON:0.15)
                                                            ↓
                                               DynamicsCompressor(리미터 역할)
                                                            ↓
                                               Guard Gain(보호 감쇠/MUTE)
                                                ├─ 출력 RMS/Peak Meter
                                                └─ Output Mix → Destination
Future licensed music input → Music Gain ────────────┘
```

기본 Dry 경로에는 Delay, Worklet, ScriptProcessor가 없다. Compressor의 내부 lookahead 등 지연은 남으며 제로 레이턴시를 보장하지 않는다. 네이티브 Convolver는 병렬 Wet 경로이며 Dry를 지연시키지 않는다.

- 초기 마이크 게인 0.2, 사용자 범위 0–1, 변경 시 Gain ramp. 0.2는 실험 시작값이며 보편적 안전값이 아니다.
- AEC/NS를 선택 가능하게 하고 AGC는 항상 OFF 요청. 하울링 억제 우선(AEC/NS ON), 음질 우선(OFF) 프리셋. 지원 여부는 getSupportedConstraints, 실제 적용 여부는 track.getSettings로 구분한다.
- 설정 변경 시 출력/스트림을 중단한다. 다음 시작은 게인 0.2부터이며 실제 적용값을 다시 확인한다.
- 마이크 Dry/Wet 모두 최종 Compressor(−6 dB threshold, 20:1, 3 ms attack)/Guard를 통과한다. Compressor는 하드 클리퍼/완벽한 brick-wall limiter가 아니다.
- 100 ms 간격의 최종 출력 RMS/Peak 검사에서 Peak > 0.85, RMS > 0.35, 또는 작은 출력에서 RMS > 0.25로 급상승 시 Guard 게인을 절반으로 낮춘다(최저 0.025). 자동 복구하지 않는다. 이는 보수적 레벨 보호이며 하울링 감지가 아니다. 가창도 감쇠할 수 있고 검사 사이 피크를 놓칠 수 있다.
- 긴급 MUTE는 Guard를 즉시 0으로 설정하고 래치한다. 게인 슬라이더로 해제할 수 없고 노래방 재시작이 필요하다. 장치/OS 버퍼의 잔여 음은 즉시 회수할 수 없다.
- 장치 변경(devicechange, 지원 시 sinkchange), 트랙 종료, 화면 이탈, 노래방 종료 시 출력을 끊고 트랙/타이머/노드를 정리한다. 감지되지 않는 OS 라우팅 변경은 사용자가 직접 MUTE/재시작해야 한다.
- 오토튠은 선택형 AudioWorklet으로 이동. OFF에서는 Dry로 crossfade 후 60 ms 뒤 Worklet 연결 해제/종료한다. 리버브는 별도 Wet Gain ramp. ON/OFF 전환은 음색 변화가 있을 수 있으며 모든 장치의 무클릭 전환은 실측이 필요하다.
- Worklet은 1024 샘플 피치 분석 이력과 28 ms 그레인 버퍼를 ON 경로에서만 사용한다. 매 오디오 블록에서 새 배열을 할당하지 않으며 분석은 1024 샘플 간격이다. 단순 chromatic pitch snap의 실험적 구현이며 전문 보컬 보정 품질을 보장하지 않는다.
- Worklet 로딩/프로세서 오류와 미지원에서는 기본 마이크 경로를 유지한다. HTTPS/localhost가 필요하다. 독립 HTML 내보내기를 위해 로컬 Worklet 소스를 번들에 포함해 Blob 모듈로 로드한다. 브라우저/보안 정책이 이를 차단하면 기본 경로로 복귀한다.
- 반주용 Music Gain과 마이크 보호 경로는 독립이다. 아직 외부 API/곡 음원/반주 소스를 연결하지 않았다. 곡 선택·타이머 재생·플레이리스트·기록은 기존 기능을 유지한다.

## 자동 검증

Node 24.19.0:

```bash
npm ci
npm run test:audio
npm run build
npm run export:demo
npm run dev -- --port 5173
```

단위 테스트 8개 통과: 기본 라우팅, 시작 취소/중복 방지, 권한 거부 정리, 오토튠 우회/모듈 오류 복귀, MUTE/장치 변경 정리, 입력 설정 변경, 레벨 보호, 합성 신호 Worklet 출력 유한성·종료.

Chromium 154/Linux 가상 마이크 테스트 통과: 실제 AudioContext와 AudioWorklet 로드/처리/해제, 리버브 전환, MUTE 래치, 트랙 종료, 반복 시작 3회. 가상 장치가 보고한 context sampleRate=44,100 Hz, baseLatency=10 ms, outputLatency=30 ms. 입력 설정은 AEC/NS true, AGC false. **이 수치는 실제 마이크→스피커 지연 또는 감소량이 아니다.**

React UI 회귀 테스트 통과: 인트로/홈/곡 선택, 노래방 ON/OFF/재시작, 리버브/오토튠 전환, MUTE, AEC 변경에 따른 중단, 진단 패널. 작은 화면에서 플레이어를 한 열로 배치해 안전 설정을 읽을 수 있게 조정했다.

프로덕션 빌드와 독립 HTML 내보내기 성공. 실기기 음질/피드백/왕복 지연은 미측정.

## 사용자 실기기 전후 비교: 음악 API 진행 전 필수

원본과 개선판을 각각 다른 폴더에서 실행한다. 같은 PC/브라우저/마이크/출력장치/OS 음량/거리/샘플레이트로 비교하고 버전을 기록한다. 원본은 초기 게인이 높으므로 OS 출력을 낮추고 유선 헤드폰부터 확인한다. 하울링을 일부러 크게 발생시키지 말고 급상승 시 MUTE/출력을 차단한다.

`audio-measurements.csv`에 다음 6개 조건을 원본/개선판 각각 기록한다.

| 조건 | 효과/AEC | 확인 사항 |
|---|---|---|
| 유선 헤드폰 | 효과 OFF, AEC OFF | 가장 짧은 경로의 음질/지연 기준 |
| 유선 헤드폰 | 리버브만 ON, AEC OFF | 원음 지연과 Wet 잔향 구분 |
| 유선 헤드폰 | 오토튠만 ON, AEC OFF | 추가 지연·음정 보정·끊김 |
| 유선 헤드폰 | 효과 OFF, AEC ON | OFF 조건 대비 음색·음량·지연 |
| 블루투스 | 효과 OFF, AEC ON/OFF | BT 프로필/장치명, 품질·추가 지연 |
| 외부 스피커 | 효과 OFF, AEC ON/OFF | 고정 거리·낮은 음량, 잔향·보호 감쇠·하울링 징후 |

블루투스/스피커의 AEC ON/OFF는 각 조건을 두 번 측정한다. 억제 성능 비교에서는 원본/개선판의 **실제 출력 음량도 맞춰서** 따로 비교한다. 초기 게인만 낮아 소리가 작아진 것을 AEC 성능 향상으로 해석하지 않는다. AEC가 실제로 적용되지 않으면 미적용으로 기록한다.

왕복 측정: 외부 2채널 녹음기/오디오 인터페이스에서 한 채널에는 입력 기준 임펄스, 다른 채널에는 앱 출력 신호를 동시에 녹음한다. 두 채널이 같은 클럭이어야 한다. 낮은 레벨의 짧은 펄스 10회 이상을 사용하고, 입력 onset과 대응 출력 onset 사이 샘플 차이를 녹음 sampleRate로 나눠 ms로 변환한다. 동일 테스트 장비/배선/장치 지연 보정 조건을 기록하고 중앙값·최대값·끊김을 보고한다. 리버브의 잔향 피크가 아닌 Dry onset을 비교한다. 전문 루프백 장비가 없으면 휴대전화 외부 녹음으로 기준 소리와 모니터 소리를 비교할 수 있지만 전파 거리·녹음 처리 영향과 오차를 함께 기록한다. 추정이 어려우면 미측정으로 둔다.

추가 수동 확인: 입력 권한 거부, 시작 중 화면 이동, MUTE 이후 슬라이더 조작, 반복 시작/종료 20회, 입력/출력 장치 분리, AEC/NS 전환 후 재시작, 오토튠 ON/OFF 반복, 화면/기록/검색/즐겨찾기 회귀. 종료 후 브라우저 마이크 표시가 사라지는지 확인한다.

통과 기준: 반복 측정에서 기본 경로 지연이 원본보다 작고, 같은 음량·배치에서 피드백 위험이 감소하며, 음질 손실·끊김이 허용 가능하고, 종료/MUTE/자원 정리가 정상이어야 한다. 원하는 최대 지연/하울링 허용 조건은 사용 환경에서 결정한다. 측정값과 결과를 검토한 후에만 음악 API 연동을 진행한다.

## 구현 파일과 향후 이전

- `src/audio/AudioEngine.js`: 캡처/라우팅/진단/수명주기/Worklet fallback
- `src/audio/FeedbackProtection.js`: 레벨 기반 보호
- `src/audio/autotune.worklet.js`: 선택형 오토튠 DSP
- `src/audio/AudioPanel.jsx`: 안전 설정 및 실제값/진단 UI
- `src/App.jsx`, `src/styles.css`: 기존 화면 통합
- `tests/audio.test.js`, `tests/raw-loader.js`, `package.json`: 검증 명령
- `README.md`, 이 문서와 측정 CSV: 실행/검증 안내

엔진 API를 UI에서 분리했다. Kotlin/Android/Pleos 코드는 구현하지 않았다. 향후 Android에서는 입력/출력 장치와 AEC, 저지연 스트림, 오디오 스레드/DSP, 생명주기·권한 처리를 네이티브 API로 다시 구현하고 실측해야 한다.
