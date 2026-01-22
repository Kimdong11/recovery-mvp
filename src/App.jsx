import React, { useEffect, useMemo, useRef, useState } from 'react';
import ROUTINES from '/src/data/routines.json';
import './App.css';

// ------------------------------------------------------------
// 업무 복구(Recovery) — "완제품 같은 MVP" 테스트 공간
// ✅ 구조 분리
// - 루틴 데이터: /src/data/routines.json
// - 스타일: /src/styles.css
// - 앱 로직/UI: /src/App.jsx
// ------------------------------------------------------------

const LS_KEY = 'recovery_mvp_v2';
const DEFAULT_STATE = {
   consented: false,
   isPro: false, // MVP: 결제 대신 데모 토글
   freeDaily: {
      date: '', // YYYY-MM-DD
      used: 0, // 무료 사용량(추천/실행 제한 실험용)
   },
   lastCheckin: null,
   sessions: [],
};

const SITUATIONS = [
   { key: 'meeting_pre', label: '회의 전' },
   { key: 'afternoon_crash', label: '오후 붕괴' },
   { key: 'stuck', label: '업무 막힘' },
   { key: 'before_leave', label: '퇴근 전' },
];

const TYPES = [
   { key: 'cognitive', label: '인지 오프로드' },
   { key: 'sensory', label: '감각 차단' },
   { key: 'movement', label: '움직임 리셋' },
   { key: 'emotion', label: '정서 안정' },
   { key: 'planning', label: '계획 정리' },
   { key: 'flow', label: '기쁨/몰입' },
];

function todayKey(d = new Date()) {
   const y = d.getFullYear();
   const m = String(d.getMonth() + 1).padStart(2, '0');
   const day = String(d.getDate()).padStart(2, '0');
   return `${y}-${m}-${day}`;
}

function loadState() {
   try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return DEFAULT_STATE;
      const parsed = JSON.parse(raw);
      return {
         ...DEFAULT_STATE,
         ...parsed,
         freeDaily: { ...DEFAULT_STATE.freeDaily, ...(parsed.freeDaily ?? {}) },
      };
   } catch {
      return DEFAULT_STATE;
   }
}

function saveState(state) {
   localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function clamp(n, min, max) {
   return Math.max(min, Math.min(max, n));
}

function scoreTypes(checkin) {
   // 단순/설명 가능한 MVP 로직
   const energy = Number(checkin.energy ?? 5);
   const tension = Number(checkin.tension ?? 5);
   const overheat = Number(checkin.overheat ?? 5);
   const urgency = Number(checkin.urgency ?? 5);
   const noise = checkin.noise;

   const noiseScore = noise === 'loud' ? 8 : noise === 'normal' ? 5 : 2;

   const scores = {
      cognitive: clamp(overheat * 10 + urgency * 3, 0, 100),
      movement: clamp(tension * 10 + (energy < 4 ? 10 : 0), 0, 100),
      sensory: clamp(noiseScore * 10 + (overheat > 6 ? 10 : 0), 0, 100),
      emotion: clamp((tension + overheat + urgency) * 4, 0, 100),
      planning: clamp((10 - energy) * 8 + urgency * 2, 0, 100),
      flow: clamp((energy > 6 ? 60 : 30) - (overheat > 7 ? 10 : 0), 0, 100),
   };

   const sorted = Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => ({ key: k, score: v, label: TYPES.find(t => t.key === k)?.label ?? k }));

   return { scores, sorted, primary: sorted[0], secondary: sorted[1] };
}

function filterRoutines({ situation, durationMin, checkin }) {
   const quiet = checkin.noise === 'quiet';
   const loud = checkin.noise === 'loud';
   const alone = !!checkin.alone;
   const walkable = !!checkin.walkable;
   const privacy = !!checkin.privacy;

   return ROUTINES.filter(r => {
      if (r.situation !== situation) return false;
      if (r.duration_min !== durationMin) return false;

      if (r.environment.walk_required && !walkable) return false;
      if (r.environment.alone_required && !alone) return false;
      if (r.environment.privacy_required && !privacy) return false;
      if (r.environment.quiet_ok === false && quiet) return false;
      if (r.environment.noise_ok === false && loud) return false;

      return true;
   });
}

function formatTime(sec) {
   const m = Math.floor(sec / 60);
   const s = sec % 60;
   return `${m}:${String(s).padStart(2, '0')}`;
}

function Pill({ children }) {
   return <span className="pill">{children}</span>;
}

function Card({ title, desc, right, children }) {
   return (
      <section className="card">
         <header className="card__head">
            <div>
               <div className="card__title">{title}</div>
               {desc ? <div className="card__desc">{desc}</div> : null}
            </div>
            {right ? <div className="card__right">{right}</div> : null}
         </header>
         {children ? <div className="card__body">{children}</div> : null}
      </section>
   );
}

function PrimaryButton({ children, onClick, disabled }) {
   return (
      <button className={`btn btn--primary ${disabled ? 'is-disabled' : ''}`} onClick={onClick} disabled={disabled}>
         {children}
      </button>
   );
}

function SecondaryButton({ children, onClick, disabled }) {
   return (
      <button className={`btn btn--secondary ${disabled ? 'is-disabled' : ''}`} onClick={onClick} disabled={disabled}>
         {children}
      </button>
   );
}

function Field({ label, hint, children }) {
   return (
      <div className="field">
         <div className="field__label">{label}</div>
         {children}
         {hint ? <div className="field__hint">{hint}</div> : null}
      </div>
   );
}

function Select({ value, onChange, options }) {
   return (
      <select className="select" value={value} onChange={e => onChange(e.target.value)}>
         {options.map(o => (
            <option key={o.value} value={o.value}>
               {o.label}
            </option>
         ))}
      </select>
   );
}

function Toggle({ checked, onChange, label }) {
   return (
      <label className="toggle">
         <span className="toggle__label">{label}</span>
         <input
            className="toggle__input"
            type="checkbox"
            checked={checked}
            onChange={e => onChange(e.target.checked)}
         />
      </label>
   );
}

function NumberSlider({ value, onChange, min = 0, max = 10 }) {
   return (
      <div className="slider">
         <input
            className="slider__range"
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={e => onChange(Number(e.target.value))}
         />
         <div className="slider__value">{value}</div>
      </div>
   );
}

function TopNav({ tab, setTab }) {
   const tabs = [
      { key: 'today', label: '오늘' },
      { key: 'routines', label: '루틴' },
      { key: 'report', label: '리포트' },
      { key: 'settings', label: '설정' },
   ];

   return (
      <nav className="nav">
         <div className="nav__inner">
            {tabs.map(t => (
               <button
                  key={t.key}
                  className={`nav__btn ${tab === t.key ? 'is-active' : ''}`}
                  onClick={() => setTab(t.key)}>
                  {t.label}
               </button>
            ))}
         </div>
      </nav>
   );
}

function Toast({ message, onClose }) {
   if (!message) return null;
   return (
      <div className="toast" role="status">
         <div className="toast__inner">
            <span>{message}</span>
            <button className="toast__close" onClick={onClose}>
               닫기
            </button>
         </div>
      </div>
   );
}

function Paywall({ onClose, onUpgrade }) {
   return (
      <div className="modal__backdrop" role="dialog" aria-modal="true">
         <div className="modal">
            <div className="modal__head">
               <div>
                  <div className="modal__title">Pro로 업그레이드</div>
                  <div className="modal__desc">₩4,900/월 · 결제는 MVP에서 데모 토글로 처리합니다.</div>
               </div>
               <button className="link" onClick={onClose}>
                  닫기
               </button>
            </div>

            <div className="modal__list">
               <div className="modal__item">✅ 상황별 루틴 무제한(추천/검색/필터 포함)</div>
               <div className="modal__item">✅ 주간 리포트 고도화(효과 TOP/패턴/자동 최적화)</div>
               <div className="modal__item">✅ 30분 루틴 및 프리셋 원탭 실행</div>
            </div>

            <div className="stack">
               <PrimaryButton onClick={onUpgrade}>Pro 데모 활성화</PrimaryButton>
               <SecondaryButton onClick={onClose}>나중에</SecondaryButton>
            </div>

            <div className="small">* 이 MVP는 결제/스토어 연동 대신, “정말 돈 낼 가치가 있는가”를 테스트합니다.</div>
         </div>
      </div>
   );
}

function SafetyBanner({ visible, onClose }) {
   if (!visible) return null;
   return (
      <div className="banner">
         <div className="banner__title">안전 안내</div>
         <div className="banner__desc">
            지금 상태가 매우 힘들게 느껴진다면, 혼자 버티지 말고 주변의 도움을 요청해 주세요. 이 앱은 진단/치료가 아닌
            웰니스 루틴 추천 도구이며, 필요 시 전문가 상담/진료를 고려할 수 있습니다.
         </div>
         <div className="mt">
            <SecondaryButton onClick={onClose}>알겠어요</SecondaryButton>
         </div>
      </div>
   );
}

export default function App() {
   const [app, setApp] = useState(() => (typeof window === 'undefined' ? DEFAULT_STATE : loadState()));
   const [screen, setScreen] = useState('welcome');
   const [tab, setTab] = useState('today');
   const [paywallOpen, setPaywallOpen] = useState(false);
   const [safetyOpen, setSafetyOpen] = useState(false);
   const [toast, setToast] = useState('');

   const [checkin, setCheckin] = useState({
      situation: 'afternoon_crash',
      timeSlot: 3,
      noise: 'normal',
      energy: 5,
      tension: 5,
      overheat: 5,
      urgency: 5,
      alone: false,
      privacy: false,
      walkable: false,
   });

   const [searchTerm, setSearchTerm] = useState('');
   const [typeFilter, setTypeFilter] = useState('all');

   const [selectedRoutineId, setSelectedRoutineId] = useState(null);
   const selectedRoutine = useMemo(() => ROUTINES.find(r => r.id === selectedRoutineId) ?? null, [selectedRoutineId]);

   const [beforeScore, setBeforeScore] = useState(5);
   const [afterScore, setAfterScore] = useState(6);
   const [helpTag, setHelpTag] = useState('호흡');

   useEffect(() => {
      if (typeof window === 'undefined') return;
      saveState(app);
   }, [app]);

   useEffect(() => {
      if (!app.consented) setScreen('welcome');
      else setScreen('app');
   }, [app.consented]);

   // 무료 사용량(하루 리셋)
   useEffect(() => {
      const tk = todayKey();
      if (app.freeDaily.date !== tk) {
         setApp(a => ({ ...a, freeDaily: { date: tk, used: 0 } }));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
   }, []);

   // 안전 플래그(진단 X): 매우 낮은 에너지 + 매우 높은 과열/긴장/급함이면 안내
   useEffect(() => {
      const riskLike = checkin.energy <= 1 && (checkin.overheat >= 9 || checkin.tension >= 9 || checkin.urgency >= 9);
      if (riskLike) setSafetyOpen(true);
   }, [checkin.energy, checkin.overheat, checkin.tension, checkin.urgency]);

   const typeScores = useMemo(() => scoreTypes(checkin), [checkin]);

   const recommendations = useMemo(() => {
      const situation = checkin.situation;
      const durationMin = Number(checkin.timeSlot);
      const pool = filterRoutines({ situation, durationMin, checkin });

      const primaryKey = typeScores.primary?.key;
      const secondaryKey = typeScores.secondary?.key;

      const byType = key => pool.filter(r => r.type === key);
      const a = primaryKey ? byType(primaryKey) : [];
      const b = secondaryKey ? byType(secondaryKey) : [];
      const rest = pool.filter(r => ![primaryKey, secondaryKey].includes(r.type));

      const merged = [...a, ...b, ...rest];
      const unique = Array.from(new Map(merged.map(r => [r.id, r])).values());

      const freeLocked = !app.isPro && app.freeDaily.used >= 1;
      const top = freeLocked ? [] : unique.slice(0, app.isPro ? 3 : 1);

      return { pool: unique, top, freeLocked };
   }, [checkin, typeScores, app.isPro, app.freeDaily.used]);

   const filteredRoutinePool = useMemo(() => {
      const term = searchTerm.trim().toLowerCase();
      return recommendations.pool.filter(r => {
         const matchesType = typeFilter === 'all' ? true : r.type === typeFilter;
         const matchesTerm = !term
            ? true
            : (r.title + ' ' + (r.purpose ?? '') + ' ' + (r.tags ?? []).join(' ')).toLowerCase().includes(term);
         return matchesType && matchesTerm;
      });
   }, [recommendations.pool, searchTerm, typeFilter]);

   const [player, setPlayer] = useState({
      running: false,
      stepIndex: 0,
      stepRemaining: 0,
      totalRemaining: 0,
   });

   const tickRef = useRef(null);

   useEffect(() => {
      if (!selectedRoutine || !player.running) return;

      if (tickRef.current) clearInterval(tickRef.current);

      tickRef.current = setInterval(() => {
         setPlayer(p => {
            if (!selectedRoutine) return p;
            if (!p.running) return p;

            const nextStepRemaining = p.stepRemaining - 1;
            const nextTotalRemaining = p.totalRemaining - 1;

            if (nextTotalRemaining <= 0) {
               clearInterval(tickRef.current);
               return { ...p, running: false, stepRemaining: 0, totalRemaining: 0 };
            }

            if (nextStepRemaining <= 0) {
               const nextIndex = Math.min(p.stepIndex + 1, selectedRoutine.steps.length - 1);
               const nextStepSeconds = selectedRoutine.steps[nextIndex].seconds;
               return {
                  ...p,
                  stepIndex: nextIndex,
                  stepRemaining: nextStepSeconds,
                  totalRemaining: nextTotalRemaining,
               };
            }

            return { ...p, stepRemaining: nextStepRemaining, totalRemaining: nextTotalRemaining };
         });
      }, 1000);

      return () => {
         if (tickRef.current) clearInterval(tickRef.current);
      };
   }, [selectedRoutineId, player.running]);

   function consumeFreeIfNeeded() {
      if (app.isPro) return;
      const tk = todayKey();
      setApp(a => {
         const cur = a.freeDaily?.date === tk ? a.freeDaily : { date: tk, used: 0 };
         return { ...a, freeDaily: { date: tk, used: (cur.used ?? 0) + 1 } };
      });
   }

   function startRoutine(routineId) {
      if (!app.isPro && app.freeDaily.used >= 1) {
         setPaywallOpen(true);
         return;
      }

      const r = ROUTINES.find(x => x.id === routineId);
      if (!r) return;

      consumeFreeIfNeeded();

      setSelectedRoutineId(routineId);
      setBeforeScore(5);
      setAfterScore(6);

      const total = r.steps.reduce((sum, s) => sum + s.seconds, 0);
      setPlayer({ running: true, stepIndex: 0, stepRemaining: r.steps[0].seconds, totalRemaining: total });

      setTab('today');
      setScreen('player');
   }

   function stopRoutine() {
      setPlayer(p => ({ ...p, running: false }));
   }

   function completeRoutineAndRate() {
      if (!selectedRoutine) return;

      const session = {
         id: `S_${Date.now()}`,
         ts: Date.now(),
         routineId: selectedRoutine.id,
         routineTitle: selectedRoutine.title,
         situation: checkin.situation,
         duration_min: selectedRoutine.duration_min,
         type: selectedRoutine.type,
         checkin: { ...checkin },
         before: beforeScore,
         after: afterScore,
         delta: afterScore - beforeScore,
         helpfulTag: helpTag,
      };

      setApp(a => ({
         ...a,
         lastCheckin: { ...checkin, ts: Date.now() },
         sessions: [session, ...(a.sessions ?? [])].slice(0, 2000),
      }));
      setToast('기록을 저장했습니다.');

      setScreen('app');
      setTab('report');
   }

   function resetAll() {
      localStorage.removeItem(LS_KEY);
      setApp(DEFAULT_STATE);
      setCheckin({
         situation: 'afternoon_crash',
         timeSlot: 3,
         noise: 'normal',
         energy: 5,
         tension: 5,
         overheat: 5,
         urgency: 5,
         alone: false,
         privacy: false,
         walkable: false,
      });
      setScreen('welcome');
      setTab('today');
      setSelectedRoutineId(null);
      setPlayer({ running: false, stepIndex: 0, stepRemaining: 0, totalRemaining: 0 });
      setToast('모든 데이터를 초기화했습니다.');
   }

   const report = useMemo(() => {
      const sessions = app.sessions ?? [];
      const last7 = sessions.filter(s => Date.now() - s.ts < 7 * 24 * 60 * 60 * 1000);

      const avgDelta = last7.length ? last7.reduce((sum, s) => sum + (s.delta ?? 0), 0) / last7.length : 0;

      const byRoutine = new Map();
      for (const s of last7) {
         const cur = byRoutine.get(s.routineId) ?? { id: s.routineId, title: s.routineTitle, count: 0, sumDelta: 0 };
         cur.count += 1;
         cur.sumDelta += s.delta ?? 0;
         byRoutine.set(s.routineId, cur);
      }

      const topRoutines = Array.from(byRoutine.values())
         .map(r => ({ ...r, avgDelta: r.sumDelta / r.count }))
         .sort((a, b) => b.avgDelta - a.avgDelta)
         .slice(0, 3);

      const bySituation = new Map();
      for (const s of last7) bySituation.set(s.situation, (bySituation.get(s.situation) ?? 0) + 1);
      const topSituation = Array.from(bySituation.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return { last7Count: last7.length, avgDelta, topRoutines, topSituation };
   }, [app.sessions]);

   // -------------------------
   // Screens
   // -------------------------

   if (screen === 'welcome') {
      return (
         <div className="page">
            <div className="container">
               <div className="kicker">업무 복구 MVP 테스트 공간 (v2)</div>
               <h1 className="h1">15초 체크인 → 실행 → 리포트</h1>
               <p className="lead">
                  진단/치료가 아닌 <b>웰니스 루틴 추천</b>입니다. 지금 가능한 환경과 시간에 맞춰 “바로 실행할 수 있는”
                  행동만 제공합니다.
               </p>

               <div className="note">
                  <div className="note__title">가격 실험(직장인)</div>
                  <div className="note__desc">
                     Free는 <b>하루 1회 추천/실행</b>만 제공하고, Pro(₩4,900/월)는 무제한/리포트를 제공합니다.
                  </div>
               </div>

               <div className="stack">
                  <PrimaryButton onClick={() => setScreen('consent')}>시작하기</PrimaryButton>
                  <SecondaryButton onClick={() => setApp(a => ({ ...a, consented: true }))}>
                     빠른 체험(동의 화면 건너뛰기)
                  </SecondaryButton>
               </div>

               <div className="small">
                  * 본 프로토타입은 기능/문구/흐름 검증용입니다.
                  <br />* 민감할 수 있는 상태 정보는 최소만 수집하며, 설정에서 즉시 삭제할 수 있습니다.
               </div>
            </div>
         </div>
      );
   }

   if (screen === 'consent') {
      return (
         <div className="page">
            <div className="container">
               <h1 className="h2">데이터는 최소로, 통제는 사용자에게</h1>
               <p className="lead">
                  상태 체크(에너지/긴장/과열 등)를 바탕으로 “지금 가능한” 루틴을 추천합니다. 이 서비스는 진단·치료
                  목적이 아닌 웰니스 행동 추천 도구입니다.
               </p>

               <div className="stack">
                  <label className="check">
                     <input type="checkbox" defaultChecked readOnly />
                     <div>
                        <div className="check__title">필수) 서비스 이용을 위한 기본 동의</div>
                        <div className="check__desc">기능 제공을 위해 기본 정보 처리가 필요합니다.</div>
                     </div>
                  </label>
                  <label className="check">
                     <input type="checkbox" defaultChecked readOnly />
                     <div>
                        <div className="check__title">필수) 상태 정보 수집·이용 동의</div>
                        <div className="check__desc">개인화 추천을 위해 최소 문항만 수집합니다.</div>
                     </div>
                  </label>
                  <label className="check">
                     <input type="checkbox" />
                     <div>
                        <div className="check__title">선택) 익명 통계 참여</div>
                        <div className="check__desc">개인 식별 없이 사용성 개선에만 활용합니다.</div>
                     </div>
                  </label>
               </div>

               <div className="stack">
                  <PrimaryButton onClick={() => setApp(a => ({ ...a, consented: true }))}>동의하고 시작</PrimaryButton>
                  <SecondaryButton onClick={() => setApp(a => ({ ...a, consented: true }))}>
                     익명 모드로 시작(추천)
                  </SecondaryButton>
               </div>

               <div className="small">설정에서 언제든 데이터를 삭제할 수 있습니다.</div>
            </div>
         </div>
      );
   }

   if (screen === 'player' && selectedRoutine) {
      const r = selectedRoutine;
      const step = r.steps[player.stepIndex];
      const done = !player.running && player.totalRemaining === 0;

      return (
         <div className="page page--soft">
            <div className="container container--pad">
               <div className="row row--between">
                  <button
                     className="link"
                     onClick={() => {
                        stopRoutine();
                        setScreen('app');
                     }}>
                     ← 나가기
                  </button>
                  <div className="small">{SITUATIONS.find(s => s.key === r.situation)?.label}</div>
               </div>

               <h1 className="h2">{r.title}</h1>
               <p className="lead">{r.purpose}</p>

               <div className="pillrow">
                  <Pill>{r.duration_min}분</Pill>
                  <Pill>{TYPES.find(t => t.key === r.type)?.label}</Pill>
                  <Pill>{r.effort === 'low' ? '쉬움' : '보통'}</Pill>
               </div>

               <div className="card">
                  <header className="card__head">
                     <div>
                        <div className="card__title">현재 단계</div>
                        <div className="card__desc strong">{step?.text}</div>
                     </div>
                  </header>
                  <div className="card__body">
                     <div className="row row--between">
                        <span className="muted">단계 남은 시간</span>
                        <span className="mono">{formatTime(player.stepRemaining)}</span>
                     </div>
                     <div className="row row--between mt">
                        <span className="muted">전체 남은 시간</span>
                        <span className="mono">{formatTime(player.totalRemaining)}</span>
                     </div>

                     <div className="grid2 mt">
                        <SecondaryButton onClick={() => setPlayer(p => ({ ...p, running: !p.running }))}>
                           {player.running ? '일시정지' : '계속'}
                        </SecondaryButton>
                        <SecondaryButton onClick={stopRoutine}>중단</SecondaryButton>
                     </div>

                     <div className="small mt">금지요소: {r.forbidden}</div>
                  </div>
               </div>

               {done ? (
                  <Card title="전/후 체감 기록" desc="정답은 없습니다. 방금 전과 비교만 해주세요.">
                     <div className="grid2">
                        <Field label="실행 전(0~10)">
                           <NumberSlider value={beforeScore} onChange={setBeforeScore} />
                        </Field>
                        <Field label="실행 후(0~10)">
                           <NumberSlider value={afterScore} onChange={setAfterScore} />
                        </Field>
                     </div>

                     <div className="mt">
                        <Field label="도움이 됐던 요소(선택)">
                           <Select
                              value={helpTag}
                              onChange={setHelpTag}
                              options={[
                                 { value: '호흡', label: '호흡' },
                                 { value: '움직임', label: '움직임' },
                                 { value: '정리', label: '정리' },
                                 { value: '차단', label: '차단' },
                                 { value: '기타', label: '기타' },
                              ]}
                           />
                        </Field>
                     </div>

                     <div className="mt">
                        <PrimaryButton onClick={completeRoutineAndRate}>완료</PrimaryButton>
                     </div>
                  </Card>
               ) : (
                  <Card title="루틴 단계" desc="타이머가 0이 되면 자동으로 기록 화면으로 이동합니다.">
                     <ol className="list">
                        {r.steps.map((s, idx) => (
                           <li key={idx} className={`list__item ${idx === player.stepIndex ? 'is-active' : ''}`}>
                              <span className="list__idx">{idx + 1}.</span>
                              <span>{s.text}</span>
                              <span className="list__time">({formatTime(s.seconds)})</span>
                           </li>
                        ))}
                     </ol>
                  </Card>
               )}

               <Toast message={toast} onClose={() => setToast('')} />
            </div>
         </div>
      );
   }

   // -------------------------
   // Main app
   // -------------------------

   return (
      <div className="page page--soft">
         <div className="container container--pad" style={{ paddingBottom: 96 }}>
            <div className="row row--between">
               <div>
                  <div className="kicker">업무 복구</div>
                  <h1 className="h2">지금 가능한 루틴</h1>
                  <div className="small">
                     {app.isPro ? 'Pro 활성' : 'Free'} · 오늘 사용: {app.freeDaily.used}/1 · 가격: ₩4,900/월
                  </div>
               </div>
               <button className="chip" onClick={resetAll} title="로컬 데이터 초기화">
                  초기화
               </button>
            </div>

            <SafetyBanner visible={safetyOpen} onClose={() => setSafetyOpen(false)} />

            {tab === 'today' ? (
               <>
                  <Card title="직장인 프리셋(원탭)" desc="상황+시간을 한 번에 세팅합니다." right={<Pill>프리셋</Pill>}>
                     <div className="grid2">
                        <SecondaryButton
                           onClick={() => setCheckin(c => ({ ...c, situation: 'meeting_pre', timeSlot: 3 }))}>
                           회의 전 · 3분
                        </SecondaryButton>
                        <SecondaryButton
                           onClick={() => setCheckin(c => ({ ...c, situation: 'meeting_pre', timeSlot: 10 }))}>
                           회의 전 · 10분
                        </SecondaryButton>
                        <SecondaryButton
                           onClick={() => setCheckin(c => ({ ...c, situation: 'afternoon_crash', timeSlot: 3 }))}>
                           오후 붕괴 · 3분
                        </SecondaryButton>
                        <SecondaryButton
                           onClick={() => setCheckin(c => ({ ...c, situation: 'afternoon_crash', timeSlot: 10 }))}>
                           오후 붕괴 · 10분
                        </SecondaryButton>
                        <SecondaryButton onClick={() => setCheckin(c => ({ ...c, situation: 'stuck', timeSlot: 3 }))}>
                           업무 막힘 · 3분
                        </SecondaryButton>
                        <SecondaryButton
                           onClick={() => setCheckin(c => ({ ...c, situation: 'before_leave', timeSlot: 3 }))}>
                           퇴근 전 · 3분
                        </SecondaryButton>
                     </div>
                     <div className="small mt">* 30분 프리셋은 Pro에서 강하게 ‘사용 이유’가 생기도록 설계했습니다.</div>
                  </Card>

                  <Card
                     title="15초 체크인"
                     desc="지금 상태와 환경을 입력하면 추천이 더 정확해집니다."
                     right={<Pill>체크인</Pill>}>
                     <div className="stack">
                        <Field label="지금 상황">
                           <Select
                              value={checkin.situation}
                              onChange={v => setCheckin(c => ({ ...c, situation: v }))}
                              options={SITUATIONS.map(s => ({ value: s.key, label: s.label }))}
                           />
                        </Field>

                        <Field label="가능한 시간">
                           <div className="grid3">
                              {[3, 10, 30].map(m => (
                                 <button
                                    key={m}
                                    className={`seg ${Number(checkin.timeSlot) === m ? 'is-active' : ''}`}
                                    onClick={() => {
                                       if (m === 30 && !app.isPro) {
                                          setPaywallOpen(true);
                                          return;
                                       }
                                       setCheckin(c => ({ ...c, timeSlot: m }));
                                    }}>
                                    {m}분{m === 30 && !app.isPro ? '(Pro)' : ''}
                                 </button>
                              ))}
                           </div>
                        </Field>

                        <Field label="환경(소음)">
                           <div className="grid3">
                              {[
                                 { v: 'quiet', l: '조용함' },
                                 { v: 'normal', l: '보통' },
                                 { v: 'loud', l: '시끄러움' },
                              ].map(x => (
                                 <button
                                    key={x.v}
                                    className={`seg ${checkin.noise === x.v ? 'is-active' : ''}`}
                                    onClick={() => setCheckin(c => ({ ...c, noise: x.v }))}>
                                    {x.l}
                                 </button>
                              ))}
                           </div>
                        </Field>

                        <div className="grid4">
                           <Field label="에너지">
                              <NumberSlider
                                 value={checkin.energy}
                                 onChange={v => setCheckin(c => ({ ...c, energy: v }))}
                              />
                           </Field>
                           <Field label="긴장">
                              <NumberSlider
                                 value={checkin.tension}
                                 onChange={v => setCheckin(c => ({ ...c, tension: v }))}
                              />
                           </Field>
                           <Field label="과열">
                              <NumberSlider
                                 value={checkin.overheat}
                                 onChange={v => setCheckin(c => ({ ...c, overheat: v }))}
                              />
                           </Field>
                           <Field label="급함">
                              <NumberSlider
                                 value={checkin.urgency}
                                 onChange={v => setCheckin(c => ({ ...c, urgency: v }))}
                              />
                           </Field>
                        </div>

                        <div className="grid3">
                           <Toggle
                              checked={checkin.alone}
                              onChange={v => setCheckin(c => ({ ...c, alone: v }))}
                              label="혼자 있음"
                           />
                           <Toggle
                              checked={checkin.privacy}
                              onChange={v => setCheckin(c => ({ ...c, privacy: v }))}
                              label="프라이버시 가능"
                           />
                           <Toggle
                              checked={checkin.walkable}
                              onChange={v => setCheckin(c => ({ ...c, walkable: v }))}
                              label="걷기 가능"
                           />
                        </div>
                     </div>
                  </Card>

                  <Card
                     title="지금 필요한 복구"
                     desc={`주요 타입: ${typeScores.primary.label} / 보조 타입: ${typeScores.secondary.label}`}
                     right={<Pill>추천</Pill>}>
                     <div className="pillrow">
                        <Pill>근거: 과열/긴장/에너지/급함/소음·제약 반영</Pill>
                        <Pill>
                           상황: {SITUATIONS.find(s => s.key === checkin.situation)?.label} · {checkin.timeSlot}분
                        </Pill>
                     </div>

                     {recommendations.freeLocked ? (
                        <div className="note mt">
                           <div className="note__title">오늘 무료 사용량을 다 썼습니다.</div>
                           <div className="note__desc">내일 다시 1회 제공되며, Pro는 무제한입니다.</div>
                           <div className="mt">
                              <PrimaryButton onClick={() => setPaywallOpen(true)}>Pro 보기(₩4,900/월)</PrimaryButton>
                           </div>
                        </div>
                     ) : (
                        <div className="stack mt">
                           {recommendations.top.length ? (
                              recommendations.top.map(r => (
                                 <button key={r.id} className="routine" onClick={() => startRoutine(r.id)}>
                                    <div className="row row--between">
                                       <div className="strong">{r.title}</div>
                                       <Pill>{TYPES.find(t => t.key === r.type)?.label}</Pill>
                                    </div>
                                    <div className="muted mt">{r.purpose}</div>
                                    <div className="small mt">금지요소: {r.forbidden}</div>
                                 </button>
                              ))
                           ) : (
                              <div className="muted">
                                 현재 조건에서 실행 가능한 루틴이 없습니다. 소음/혼자/프라이버시/걷기 옵션을 바꿔보세요.
                              </div>
                           )}
                        </div>
                     )}

                     <div className="grid2 mt">
                        <SecondaryButton
                           onClick={() => {
                              const quick = recommendations.top[0]?.id;
                              if (quick) startRoutine(quick);
                           }}
                           disabled={recommendations.freeLocked}>
                           가장 쉬운 1개 실행
                        </SecondaryButton>
                        <SecondaryButton
                           onClick={() => {
                              if (!app.isPro) {
                                 setPaywallOpen(true);
                                 return;
                              }
                              setTab('routines');
                           }}>
                           전체 루틴(검색)
                        </SecondaryButton>
                     </div>
                  </Card>
               </>
            ) : null}

            {tab === 'routines' ? (
               <>
                  {!app.isPro ? (
                     <Card
                        title="루틴 검색은 Pro 기능"
                        desc="무료는 추천 1개로 ‘효과’를 체감시키고, Pro에서 ‘탐색/최적화’를 제공합니다.">
                        <PrimaryButton onClick={() => setPaywallOpen(true)}>Pro 보기(₩4,900/월)</PrimaryButton>
                     </Card>
                  ) : (
                     <Card
                        title="루틴 목록"
                        desc="검색/필터로 ‘지금 당장 가능한 것’만 빠르게 찾습니다."
                        right={<Pill>{SITUATIONS.find(s => s.key === checkin.situation)?.label}</Pill>}>
                        <div className="stack">
                           <Field label="검색">
                              <input
                                 className="input"
                                 value={searchTerm}
                                 onChange={e => setSearchTerm(e.target.value)}
                                 placeholder="예: 호흡, 걷기, QnA, 알림OFF"
                              />
                           </Field>

                           <Field label="타입 필터">
                              <Select
                                 value={typeFilter}
                                 onChange={setTypeFilter}
                                 options={[
                                    { value: 'all', label: '전체' },
                                    ...TYPES.map(t => ({ value: t.key, label: t.label })),
                                 ]}
                              />
                           </Field>

                           <div className="small">
                              * 현재 체크인의 상황/시간/환경 제약을 만족하는 루틴만 노출됩니다.
                           </div>

                           <div className="stack">
                              {filteredRoutinePool.map(r => (
                                 <button key={r.id} className="routine" onClick={() => startRoutine(r.id)}>
                                    <div className="row row--between">
                                       <div className="strong">{r.title}</div>
                                       <Pill>
                                          {r.duration_min}분 · {TYPES.find(t => t.key === r.type)?.label}
                                       </Pill>
                                    </div>
                                    <div className="muted mt">{r.purpose}</div>
                                    <div className="pillrow mt">
                                       {(r.tags ?? []).slice(0, 4).map(t => (
                                          <Pill key={t}>{t}</Pill>
                                       ))}
                                    </div>
                                 </button>
                              ))}
                              {!filteredRoutinePool.length ? (
                                 <div className="muted">
                                    조건에 맞는 루틴이 없습니다. 체크인(소음/혼자/프라이버시/걷기)을 바꿔보세요.
                                 </div>
                              ) : null}
                           </div>
                        </div>
                     </Card>
                  )}
               </>
            ) : null}

            {tab === 'report' ? (
               <>
                  <Card title="이번 주 복구 요약" desc="최근 7일 기준(localStorage)">
                     <div className="grid3">
                        <div className="stat">
                           <div className="stat__k">세션 수</div>
                           <div className="stat__v">{report.last7Count}</div>
                        </div>
                        <div className="stat">
                           <div className="stat__k">평균 개선(Δ)</div>
                           <div className="stat__v">{report.avgDelta.toFixed(1)}</div>
                        </div>
                        <div className="stat">
                           <div className="stat__k">많이 온 상황</div>
                           <div className="stat__v stat__v--small">
                              {report.topSituation ? SITUATIONS.find(s => s.key === report.topSituation)?.label : '-'}
                           </div>
                        </div>
                     </div>

                     <div className="mt">
                        <div className="strong">효과가 높았던 루틴 TOP 3</div>
                        <div className="stack mt">
                           {report.topRoutines.length ? (
                              report.topRoutines.map(r => (
                                 <div key={r.id} className="row row--between stat">
                                    <div>
                                       <div className="strong">{r.title}</div>
                                       <div className="small">실행 {r.count}회</div>
                                    </div>
                                    <Pill>평균 Δ {r.avgDelta.toFixed(1)}</Pill>
                                 </div>
                              ))
                           ) : (
                              <div className="muted">아직 기록이 없습니다. 루틴을 1개 실행해보세요.</div>
                           )}
                        </div>
                     </div>
                  </Card>

                  {!app.isPro ? (
                     <Card
                        title="리포트 고도화는 Pro"
                        desc="패턴(시간대/환경/반복 실패 요인)을 자동으로 뽑아주는 기능은 유료로 설계합니다.">
                        <PrimaryButton onClick={() => setPaywallOpen(true)}>Pro 보기(₩4,900/월)</PrimaryButton>
                     </Card>
                  ) : (
                     <Card title="Pro 리포트 미리보기" desc="MVP에선 ‘보여주기’로 가치 검증만 합니다.">
                        <ul className="ul">
                           <li>반복 붕괴 시간대: 오후 2~4시(가정)</li>
                           <li>방해요소 TOP: 알림/탭 과다/급함 점수</li>
                           <li>다음 주 추천: 감각 차단 + 단일 작업 블록을 우선</li>
                        </ul>
                     </Card>
                  )}

                  <Card title="최근 세션" desc="최신 10개">
                     <div className="stack">
                        {(app.sessions ?? []).slice(0, 10).map(s => (
                           <div key={s.id} className="stat">
                              <div className="row row--between">
                                 <div className="strong">{s.routineTitle}</div>
                                 <Pill>Δ {Number(s.delta ?? 0).toFixed(0)}</Pill>
                              </div>
                              <div className="small mt">
                                 {new Date(s.ts).toLocaleString()} ·{' '}
                                 {SITUATIONS.find(x => x.key === s.situation)?.label} · {s.duration_min}분
                              </div>
                           </div>
                        ))}
                     </div>
                  </Card>
               </>
            ) : null}

            {tab === 'settings' ? (
               <>
                  <Card title="Pro 데모" desc="MVP에서 결제 대신 ‘토글’로 유료 가치를 테스트합니다.">
                     <div className="stack">
                        <Toggle
                           checked={app.isPro}
                           onChange={v => setApp(a => ({ ...a, isPro: v }))}
                           label="Pro 활성화(데모)"
                        />
                        <div className="small">가격 가정: ₩4,900/월</div>
                     </div>
                  </Card>

                  <Card
                     title="알림(테스트용)"
                     desc="실제 푸시는 MVP에서 구현하지 않고, 문구/타이밍 가치를 테스트합니다.">
                     <div className="stack">
                        <SecondaryButton
                           onClick={() => alert('회의 10분 전: ‘지금 3분만 준비하면 회의가 훨씬 부드러워집니다.’')}>
                           회의 전 문구
                        </SecondaryButton>
                        <SecondaryButton
                           onClick={() => alert('오후 2~4시: ‘오후 집중이 끊기는 시간입니다, 3분만 리셋해보세요.’')}>
                           오후 붕괴 문구
                        </SecondaryButton>
                        <SecondaryButton
                           onClick={() => alert('퇴근 10분 전: ‘퇴근 후 잔상을 줄이는 3분 마감 루틴을 해볼까요?’')}>
                           퇴근 전 문구
                        </SecondaryButton>
                     </div>
                  </Card>

                  <Card title="데이터" desc="로컬 저장(localStorage) 기반입니다.">
                     <div className="stack">
                        <SecondaryButton
                           onClick={() => {
                              const blob = new Blob([JSON.stringify(app, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = 'recovery_mvp_export.json';
                              a.click();
                              URL.revokeObjectURL(url);
                              setToast('JSON 다운로드를 시작했습니다.');
                           }}>
                           내 데이터 다운로드(JSON)
                        </SecondaryButton>
                        <SecondaryButton onClick={resetAll}>내 데이터 삭제(즉시)</SecondaryButton>
                     </div>
                  </Card>

                  <Card title="안전 안내" desc="이 앱은 웰니스 루틴 추천 도구입니다.">
                     <div className="muted">
                        상태가 매우 힘들다고 느껴지거나 일상 기능이 크게 흔들릴 때는, 주변의 도움을 요청하거나 전문적인
                        상담/진료를 고려해 주세요.
                     </div>
                  </Card>
               </>
            ) : null}

            <TopNav tab={tab} setTab={setTab} />

            {paywallOpen ? (
               <Paywall
                  onClose={() => setPaywallOpen(false)}
                  onUpgrade={() => {
                     setApp(a => ({ ...a, isPro: true }));
                     setPaywallOpen(false);
                     setToast('Pro 데모를 활성화했습니다.');
                  }}
               />
            ) : null}

            <Toast message={toast} onClose={() => setToast('')} />
         </div>
      </div>
   );
}
