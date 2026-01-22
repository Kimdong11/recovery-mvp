import React, { useEffect, useMemo, useRef, useState } from 'react';

// ------------------------------------------------------------
// "업무 복구" 테스트 공간(MVP 프로토타입)
// - 15초 체크인 → 추천 → 루틴 타이머 → 전/후 체감 기록
// - localStorage 저장(세션/기록)
// - 의료/진단 주장 없이: 웰니스 루틴 추천용 문구만 사용
// ------------------------------------------------------------

const LS_KEY = 'recovery_mvp_v1';

const DEFAULT_STATE = {
   consented: false,
   profile: {
      jobType: '',
      workStyle: '',
   },
   lastCheckin: null,
   sessions: [],
};

// --- 루틴 데이터(샘플): 필요하면 여기 JSON을 그대로 교체/추가하세요 ---
const ROUTINES = [
   {
      id: 'MEET_3M_001',
      title: '회의 전 호흡-목소리 리셋 3분',
      situation: 'meeting_pre',
      duration_min: 3,
      type: 'emotion',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '호흡과 발성 준비로 말이 막히는 느낌을 줄입니다.',
      steps: [
         { text: '4초 들숨-4초 멈춤-6초 날숨을 6회 반복합니다.', seconds: 90 },
         { text: '입술 트릴 또는 ‘음—’ 허밍을 30초간 가볍게 합니다.', seconds: 30 },
         { text: '첫 문장(핵심 결론 1줄)을 속으로 3번 말합니다.', seconds: 60 },
      ],
      forbidden: '완벽한 말투를 만들려 애쓰지 않습니다.',
      tags: ['회의전', '발표전', '긴장완화', '호흡', '발성', '원탭가능'],
   },
   {
      id: 'MEET_3M_002',
      title: '회의 전 어깨-턱 긴장 해제 3분',
      situation: 'meeting_pre',
      duration_min: 3,
      type: 'movement',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '목·어깨·턱 긴장을 내려 말과 표정이 부드러워집니다.',
      steps: [
         { text: '어깨를 귀 쪽으로 3초 올렸다가 5초 내려 5회 반복합니다.', seconds: 60 },
         { text: '턱을 살짝 벌리고 혀를 윗니 뒤에 두어 30초 유지합니다.', seconds: 30 },
         { text: '목 옆을 천천히 늘리며 좌우 30초씩 호흡합니다.', seconds: 90 },
      ],
      forbidden: '통증이 생길 만큼 스트레칭하지 않습니다.',
      tags: ['회의전', '긴장완화', '목어깨', '턱긴장', '자세'],
   },
   {
      id: 'MEET_3M_003',
      title: '회의 전 핵심 한 줄 정리 3분',
      situation: 'meeting_pre',
      duration_min: 3,
      type: 'cognitive',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '말할 내용을 ‘결론 1줄’로 고정해 흔들림을 줄입니다.',
      steps: [
         { text: '오늘 회의에서 얻고 싶은 결과를 한 문장으로 씁니다.', seconds: 60 },
         { text: '근거 2개만 불릿으로 적습니다.', seconds: 60 },
         { text: '상대가 물을 질문 1개를 예상하고 답을 한 줄로 씁니다.', seconds: 60 },
      ],
      forbidden: '자료 전체를 다시 읽으려 하지 않습니다.',
      tags: ['회의전', '정리', '결론한줄', 'QnA', '말문막힘'],
   },
   {
      id: 'MEET_3M_004',
      title: '회의 전 시선-자세 안정 3분',
      situation: 'meeting_pre',
      duration_min: 3,
      type: 'emotion',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '시선과 자세를 안정시켜 불필요한 불안 신호를 줄입니다.',
      steps: [
         { text: '등받이에 등을 붙이고 골반을 세워 10초 호흡합니다.', seconds: 40 },
         { text: '화면/테이블의 한 지점을 20초 응시하며 호흡을 느낍니다.', seconds: 80 },
         { text: '회의 시작 후 할 ‘첫 행동(메모 열기/안건 확인)’을 마음속으로 정합니다.', seconds: 60 },
      ],
      forbidden: '자세를 억지로 고정해 긴장을 더 만들지 않습니다.',
      tags: ['회의전', '불안완화', '시선', '자세', '준비'],
   },
   {
      id: 'MEET_3M_005',
      title: '회의 전 ‘상대 관점’ 전환 3분',
      situation: 'meeting_pre',
      duration_min: 3,
      type: 'planning',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '상대가 원하는 것을 먼저 떠올려 대화가 쉬워집니다.',
      steps: [
         { text: '상대가 원하는 결과를 1줄로 적습니다.', seconds: 60 },
         { text: '상대의 리스크(시간/예산/품질) 1개를 적습니다.', seconds: 60 },
         { text: '내가 줄 수 있는 ‘다음 행동 1개’를 1줄로 적습니다.', seconds: 60 },
      ],
      forbidden: '상대를 설득하려는 말부터 시작하지 않습니다.',
      tags: ['회의전', '커뮤니케이션', '관점전환', '요청', '조율'],
   },
   {
      id: 'MEET_10M_001',
      title: '회의 전 10분 프리브리프',
      situation: 'meeting_pre',
      duration_min: 10,
      type: 'planning',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'mid',
      purpose: '회의 흐름을 10분 안에 예열해 참여 피로를 줄입니다.',
      steps: [
         { text: '안건을 3줄로 요약합니다(배경/문제/결정).', seconds: 240 },
         { text: '내 역할을 1줄로 정의합니다(결정/보고/조율).', seconds: 180 },
         { text: '회의 후 ‘내가 할 다음 행동 1개’를 메모/캘린더에 박아둡니다.', seconds: 180 },
      ],
      forbidden: '회의 자료 전체를 완독하려 하지 않습니다.',
      tags: ['회의전', '브리프', '요약', '역할정의', '다음행동'],
   },
   {
      id: 'MEET_10M_002',
      title: '회의 전 긴장 완화 워킹 10분',
      situation: 'meeting_pre',
      duration_min: 10,
      type: 'movement',
      environment: {
         quiet_ok: false,
         noise_ok: true,
         alone_required: false,
         walk_required: true,
         seat_ok: false,
         privacy_required: false,
      },
      effort: 'mid',
      purpose: '가벼운 움직임으로 긴장을 빼고 집중을 올립니다.',
      steps: [
         { text: '천천히 3분 걷고 호흡을 느낍니다.', seconds: 180 },
         { text: '1분 동안 어깨 원 돌리기와 팔 흔들기를 합니다.', seconds: 60 },
         { text: '마지막 6분 동안 ‘결론 1줄’을 머릿속으로 반복하며 걷습니다.', seconds: 360 },
      ],
      forbidden: '속도를 올려 땀나는 운동으로 만들지 않습니다.',
      tags: ['회의전', '걷기', '긴장완화', '집중', '루틴'],
   },
   {
      id: 'MEET_10M_003',
      title: '회의 전 반박 대비 10분(질문 3개 시뮬레이션)',
      situation: 'meeting_pre',
      duration_min: 10,
      type: 'cognitive',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: true,
         walk_required: false,
         seat_ok: true,
         privacy_required: true,
      },
      effort: 'mid',
      purpose: '예상 질문을 준비해 당황을 줄입니다.',
      steps: [
         { text: '나올 질문 3개를 적습니다.', seconds: 180 },
         { text: '각 질문에 답을 ‘결론 1줄 + 근거 1줄’로 씁니다.', seconds: 300 },
         { text: '가장 어려운 질문 1개만 소리 내어 2회 말해봅니다.', seconds: 120 },
      ],
      forbidden: '모든 경우의 수를 다 준비하려 하지 않습니다.',
      tags: ['회의전', 'QnA', '반박대비', '말하기', '준비'],
   },
   {
      id: 'MEET_10M_004',
      title: '회의 전 감각 차단 10분(알림 과부하 차단)',
      situation: 'meeting_pre',
      duration_min: 10,
      type: 'sensory',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '자극을 줄여 회의 집중을 위한 여백을 만듭니다.',
      steps: [
         { text: '알림을 30분만 끄고, 화면 밝기를 낮춥니다.', seconds: 60 },
         { text: '4분간 무음/백색소음으로 앉아 호흡합니다(가능하면).', seconds: 240 },
         { text: '회의에서 필요한 화면/문서만 열어 정리합니다.', seconds: 300 },
      ],
      forbidden: 'SNS를 “잠깐” 보지 않습니다.',
      tags: ['회의전', '감각차단', '알림OFF', '집중', '정리'],
   },
   {
      id: 'MEET_10M_005',
      title: '회의 전 관계 리셋 10분(표정·말투 준비)',
      situation: 'meeting_pre',
      duration_min: 10,
      type: 'emotion',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: true,
         walk_required: false,
         seat_ok: true,
         privacy_required: true,
      },
      effort: 'mid',
      purpose: '관계 에너지를 정리해 회의 분위기를 부드럽게 합니다.',
      steps: [
         { text: '상대에게 전할 메시지를 ‘요청 1줄’로 씁니다.', seconds: 180 },
         { text: '문장을 ‘사실-영향-요청’ 형태로 바꿉니다.', seconds: 300 },
         { text: '첫 문장을 부드럽게 바꾼 버전으로 3번 읽습니다.', seconds: 120 },
      ],
      forbidden: '상대를 평가하는 문장으로 시작하지 않습니다.',
      tags: ['회의전', '관계', '커뮤니케이션', '요청', '톤조절'],
   },

   {
      id: 'AFTER_3M_001',
      title: '오후 리셋 호흡 3분(카페인 대신)',
      situation: 'afternoon_crash',
      duration_min: 3,
      type: 'emotion',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '호흡으로 각성을 조금 올려 오후 무너짐을 줄입니다.',
      steps: [
         { text: '코로 3초 들숨-입으로 6초 날숨을 10회 합니다.', seconds: 90 },
         { text: '시선을 멀리 두고 호흡을 느낍니다(눈을 감지 않음).', seconds: 60 },
         { text: '지금 할 ‘다음 행동 1개’를 한 줄로 씁니다.', seconds: 30 },
      ],
      forbidden: '바로 커피부터 찾지 않습니다.',
      tags: ['오후붕괴', '호흡', '각성', '다음행동', '카페인대신'],
   },
   {
      id: 'AFTER_3M_002',
      title: '오후 하체 펌핑 3분(앉아 있는 피로 해소)',
      situation: 'afternoon_crash',
      duration_min: 3,
      type: 'movement',
      environment: {
         quiet_ok: false,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'mid',
      purpose: '하체 순환을 깨워 멍함을 줄입니다.',
      steps: [
         { text: '발뒤꿈치를 들었다 내리는 동작을 반복합니다.', seconds: 60 },
         { text: '의자에서 일어나 제자리 걷기 60초를 합니다.', seconds: 60 },
         { text: '어깨를 10회 크게 돌리고 물 한 모금을 마십니다.', seconds: 60 },
      ],
      forbidden: '숨이 찰 정도로 강도를 올리지 않습니다.',
      tags: ['오후붕괴', '순환', '하체', '각성', '가벼운운동'],
   },
   {
      id: 'AFTER_3M_003',
      title: '오후 화면 피로 컷 3분(눈-뇌 과열 차단)',
      situation: 'afternoon_crash',
      duration_min: 3,
      type: 'sensory',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '시각 자극을 줄여 뇌 과열을 낮춥니다.',
      steps: [
         { text: '먼 곳을 바라보고 깜빡임을 늘립니다.', seconds: 60 },
         { text: '화면 밝기를 낮추고 알림을 20분만 끕니다.', seconds: 60 },
         { text: '목 뒤를 마사지하고 턱 힘을 풉니다.', seconds: 60 },
      ],
      forbidden: '짧은 휴식에 유튜브를 켜지 않습니다.',
      tags: ['오후붕괴', '눈피로', '화면피로', '알림OFF', '감각차단'],
   },
   {
      id: 'AFTER_3M_004',
      title: '오후 3분 작업 재정렬(우선순위 1개만)',
      situation: 'afternoon_crash',
      duration_min: 3,
      type: 'planning',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '할 일을 줄여 부담감을 낮추고 다시 움직입니다.',
      steps: [
         { text: '지금 해야 할 일을 5개 이하로 적습니다.', seconds: 60 },
         { text: '‘오늘 반드시 1개’를 동그라미 칩니다.', seconds: 30 },
         { text: '그 1개를 10분짜리 첫 단계로 쪼갭니다.', seconds: 90 },
      ],
      forbidden: '새로운 일을 추가로 받지 않습니다.',
      tags: ['오후붕괴', '우선순위', '재정렬', '부담감감소', '한가지'],
   },
   {
      id: 'AFTER_3M_005',
      title: '오후 감각 차단 3분(소음·사람 과부하 대응)',
      situation: 'afternoon_crash',
      duration_min: 3,
      type: 'sensory',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: false,
         privacy_required: true,
      },
      effort: 'low',
      purpose: '자극을 줄여 회복을 빠르게 시작합니다.',
      steps: [
         { text: '가능한 조용한 곳으로 이동합니다(화장실/계단/구석).', seconds: 60 },
         { text: '어깨 힘을 빼며 1분 호흡합니다.', seconds: 60 },
         { text: '오늘 남은 시간표를 1줄로 적어 끝이 보이게 만듭니다.', seconds: 60 },
      ],
      forbidden: '동료 메시지에 즉시 반응하려 하지 않습니다.',
      tags: ['오후붕괴', '과자극', '사람피로', '소음', '감각차단'],
   },
   {
      id: 'AFTER_10M_001',
      title: '오후 10분 ‘미니 파워다운’',
      situation: 'afternoon_crash',
      duration_min: 10,
      type: 'sensory',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '과부하를 낮춰 오후 생산성을 회복합니다.',
      steps: [
         { text: '알림을 10분만 끄고 화면을 최소화합니다.', seconds: 120 },
         { text: '3분 호흡 + 2분 스트레칭을 합니다.', seconds: 300 },
         { text: '남은 업무를 2개로만 압축합니다(필수/하면 좋음).', seconds: 180 },
      ],
      forbidden: '“쉬는 김에” 정보를 더 소비하지 않습니다.',
      tags: ['오후붕괴', '파워다운', '알림OFF', '스트레칭', '업무압축'],
   },
   {
      id: 'AFTER_10M_002',
      title: '오후 10분 걷기 리셋(야외/복도)',
      situation: 'afternoon_crash',
      duration_min: 10,
      type: 'movement',
      environment: {
         quiet_ok: false,
         noise_ok: true,
         alone_required: false,
         walk_required: true,
         seat_ok: false,
         privacy_required: false,
      },
      effort: 'mid',
      purpose: '환경을 바꿔 멍함을 끊습니다.',
      steps: [
         { text: '5분 천천히 걷습니다.', seconds: 300 },
         { text: '‘해야 할 행동 1개’를 정하며 걷습니다.', seconds: 180 },
         { text: '복귀 후 바로 할 10분 작업을 타이머로 예약합니다.', seconds: 120 },
      ],
      forbidden: '걸으면서 메신저를 보지 않습니다.',
      tags: ['오후붕괴', '걷기', '환경전환', '예약', '집중복구'],
   },
   {
      id: 'AFTER_10M_003',
      title: '오후 10분 업무 복구(10분 타이머 집중)',
      situation: 'afternoon_crash',
      duration_min: 10,
      type: 'planning',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'mid',
      purpose: '짧은 성공 경험으로 다시 리듬을 잡습니다.',
      steps: [
         { text: '가장 쉬운 업무 1개를 고릅니다.', seconds: 60 },
         { text: '10분 타이머를 켜고 그 일만 합니다.', seconds: 480 },
         { text: '다음 10분 작업 1개만 예약합니다.', seconds: 60 },
      ],
      forbidden: '멀티태스킹을 시작하지 않습니다.',
      tags: ['오후붕괴', '타이머', '단일작업', '성공경험', '리듬'],
   },
   {
      id: 'AFTER_10M_004',
      title: '오후 10분 긴장 해소 루틴(상체 집중)',
      situation: 'afternoon_crash',
      duration_min: 10,
      type: 'movement',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'mid',
      purpose: '상체 긴장을 풀어 집중 저하를 줄입니다.',
      steps: [
         { text: '목/어깨 가동 4분을 합니다.', seconds: 240 },
         { text: '턱 힘 풀기 + 복식 호흡 3분을 합니다.', seconds: 180 },
         { text: '물 1컵을 마시고 자리 정리를 3분만 합니다.', seconds: 180 },
      ],
      forbidden: '과하게 뻗거나 힘주지 않습니다.',
      tags: ['오후붕괴', '상체긴장', '복식호흡', '정리', '물'],
   },
   {
      id: 'AFTER_10M_005',
      title: '오후 10분 인지 오프로드(머리 비우기 아님, 꺼내기)',
      situation: 'afternoon_crash',
      duration_min: 10,
      type: 'cognitive',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'mid',
      purpose: '생각을 밖으로 꺼내 부담을 낮춥니다.',
      steps: [
         { text: '머릿속 떠오르는 일을 전부 적습니다.', seconds: 240 },
         { text: '‘오늘/나중’으로만 분류합니다.', seconds: 180 },
         { text: '오늘 항목 중 1개만 ‘첫 행동’으로 확정합니다.', seconds: 180 },
      ],
      forbidden: '정리의 완벽함을 목표로 하지 않습니다.',
      tags: ['오후붕괴', '인지오프로드', '불안감감소', '분류', '첫행동'],
   },

   {
      id: 'STUCK_3M_001',
      title: '막힘 해제 ‘다음 행동 1개’ 3분',
      situation: 'stuck',
      duration_min: 3,
      type: 'planning',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '막힘을 ‘다음 행동’으로 바꿔 다시 진행합니다.',
      steps: [
         { text: '지금 막힌 이유를 한 줄로 씁니다.', seconds: 60 },
         { text: '필요한 정보/결정/승인 중 무엇인지 체크합니다.', seconds: 60 },
         { text: '지금 당장 가능한 행동 1개를 10분 단위로 정합니다.', seconds: 60 },
      ],
      forbidden: '전체 작업을 한 번에 해결하려 하지 않습니다.',
      tags: ['업무막힘', '다음행동', '진행', '승인', '결정'],
   },
   {
      id: 'STUCK_3M_002',
      title: '막힘 해제 ‘초안 1줄’ 3분',
      situation: 'stuck',
      duration_min: 3,
      type: 'cognitive',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '완벽주의를 끊고 초안을 시작합니다.',
      steps: [
         { text: '결론 한 줄만 씁니다(틀려도 됨).', seconds: 60 },
         { text: '근거 2개를 불릿으로 적습니다.', seconds: 60 },
         { text: '첫 문단/첫 슬라이드 문장 1개를 더 씁니다.', seconds: 60 },
      ],
      forbidden: '처음부터 최종본을 쓰지 않습니다.',
      tags: ['업무막힘', '초안', '완벽주의컷', '결론', '슬라이드'],
   },
   {
      id: 'STUCK_3M_003',
      title: '막힘 해제 ‘자료 정리 3분’(탭 정리)',
      situation: 'stuck',
      duration_min: 3,
      type: 'sensory',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '혼란을 줄여 집중을 회복합니다.',
      steps: [
         { text: '열린 탭/창을 5개 이하로 줄입니다.', seconds: 90 },
         { text: '지금 작업에 필요한 문서 1개만 남깁니다.', seconds: 60 },
         { text: '다음 10분 동안 할 작업을 한 줄로 고정합니다.', seconds: 30 },
      ],
      forbidden: '새 탭을 열지 않습니다.',
      tags: ['업무막힘', '탭정리', '집중', '혼란감소', '작업고정'],
   },
   {
      id: 'STUCK_3M_004',
      title: '막힘 해제 ‘질문 한 개’ 3분(도움 요청 준비)',
      situation: 'stuck',
      duration_min: 3,
      type: 'planning',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: true,
         walk_required: false,
         seat_ok: true,
         privacy_required: true,
      },
      effort: 'low',
      purpose: '막힘을 커뮤니케이션으로 빠르게 풀 준비를 합니다.',
      steps: [
         { text: '막힌 지점을 한 문장으로 씁니다.', seconds: 60 },
         { text: '상대에게 물을 질문을 딱 1개로 줄입니다.', seconds: 60 },
         { text: '필요한 맥락 2줄(배경/현재 상태)을 붙입니다.', seconds: 60 },
      ],
      forbidden: '장문의 하소연 메시지를 보내지 않습니다.',
      tags: ['업무막힘', '도움요청', '질문1개', '맥락2줄', '짧게'],
   },
   {
      id: 'STUCK_3M_005',
      title: '막힘 해제 ‘환경 전환 3분’(자리에서 벗어나기)',
      situation: 'stuck',
      duration_min: 3,
      type: 'movement',
      environment: {
         quiet_ok: false,
         noise_ok: true,
         alone_required: false,
         walk_required: true,
         seat_ok: false,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '환경을 바꿔 인지 리셋을 걸어줍니다.',
      steps: [
         { text: '자리에서 일어나 물을 마시며 1분 걷습니다.', seconds: 60 },
         { text: '돌아와서 화면 밝기/알림을 줄입니다.', seconds: 60 },
         { text: '작업을 10분짜리 작은 조각으로 쪼갭니다.', seconds: 60 },
      ],
      forbidden: '자리 이동 중 휴대폰을 보지 않습니다.',
      tags: ['업무막힘', '환경전환', '걷기', '리셋', '작게쪼개기'],
   },
   {
      id: 'STUCK_10M_001',
      title: '막힘 해제 10분 ‘문제 재정의’',
      situation: 'stuck',
      duration_min: 10,
      type: 'cognitive',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: true,
         walk_required: false,
         seat_ok: true,
         privacy_required: true,
      },
      effort: 'mid',
      purpose: '문제를 다시 정의해 잘못된 방향의 시간을 줄입니다.',
      steps: [
         { text: '문제를 ‘무엇을 결정해야 하나?’로 바꿔 씁니다.', seconds: 180 },
         { text: '필수 조건 3개를 적습니다.', seconds: 180 },
         { text: '선택지 2개만 만들고 다음 행동 1개를 고릅니다.', seconds: 240 },
      ],
      forbidden: '선택지를 무한히 늘리지 않습니다.',
      tags: ['업무막힘', '문제재정의', '조건3개', '선택지2개', '결정'],
   },
   {
      id: 'STUCK_10M_002',
      title: '막힘 해제 10분 ‘초안→검증’',
      situation: 'stuck',
      duration_min: 10,
      type: 'planning',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: true,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'mid',
      purpose: '초안을 만들어 검증 가능한 상태로 바꿉니다.',
      steps: [
         { text: '초안을 5줄로 작성합니다.', seconds: 240 },
         { text: '불확실한 부분을 [확인 필요]로 표시합니다.', seconds: 120 },
         { text: '검증할 질문 2개만 정해 담당자/자료를 연결합니다.', seconds: 240 },
      ],
      forbidden: '확실해질 때까지 시작을 미루지 않습니다.',
      tags: ['업무막힘', '초안', '검증', '질문2개', '확인필요'],
   },
   {
      id: 'STUCK_10M_003',
      title: '막힘 해제 10분 ‘정보 수집 컷’',
      situation: 'stuck',
      duration_min: 10,
      type: 'cognitive',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'mid',
      purpose: '정보 과잉을 멈추고 실행으로 전환합니다.',
      steps: [
         { text: '필요한 정보 키워드를 3개로 제한합니다.', seconds: 120 },
         { text: '검색/자료 확인을 6분만 하고 종료합니다.', seconds: 360 },
         { text: '남은 공백을 가정으로 채워 다음 행동을 진행합니다.', seconds: 120 },
      ],
      forbidden: '자료 수집 시간을 계속 늘리지 않습니다.',
      tags: ['업무막힘', '정보과잉', '키워드3개', '타임박싱', '실행전환'],
   },
   {
      id: 'STUCK_10M_004',
      title: '막힘 해제 10분 ‘도움 요청 패킷’ 작성',
      situation: 'stuck',
      duration_min: 10,
      type: 'planning',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: true,
         walk_required: false,
         seat_ok: true,
         privacy_required: true,
      },
      effort: 'mid',
      purpose: '짧고 정확한 도움 요청으로 해결 속도를 올립니다.',
      steps: [
         { text: '현재 상태를 3줄로 요약합니다(목표/진행/막힘).', seconds: 240 },
         { text: '질문 1개와 선택지 2개를 제안합니다.', seconds: 240 },
         { text: '예/아니오 또는 A/B로 답하기 쉬운 형태로 마무리합니다.', seconds: 120 },
      ],
      forbidden: '결정을 상대에게 떠넘기지 않습니다.',
      tags: ['업무막힘', '도움요청', '3줄요약', '선택지2개', 'AB질문'],
   },
   {
      id: 'STUCK_10M_005',
      title: '막힘 해제 10분 ‘집중 보호’',
      situation: 'stuck',
      duration_min: 10,
      type: 'sensory',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'mid',
      purpose: '집중을 보호해 막힘이 반복되지 않게 합니다.',
      steps: [
         { text: '알림을 20분 꺼두고 방해요소 1개를 치웁니다.', seconds: 120 },
         { text: '10분 타이머로 작업 1개만 진행합니다.', seconds: 360 },
         { text: '다음 10분 작업을 예약해 흐름을 이어갑니다.', seconds: 120 },
      ],
      forbidden: '중간에 메신저를 확인하지 않습니다.',
      tags: ['업무막힘', '집중보호', '알림OFF', '단일작업', '예약'],
   },

   {
      id: 'LEAVE_3M_001',
      title: '퇴근 전 ‘미완료 정리 3분’',
      situation: 'before_leave',
      duration_min: 3,
      type: 'planning',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '미완료 부담을 줄여 퇴근 후 잔상을 낮춥니다.',
      steps: [
         { text: '오늘 못 한 일을 3개만 적습니다.', seconds: 60 },
         { text: '각 항목의 ‘첫 행동’만 한 줄로 적습니다.', seconds: 60 },
         { text: '내일 시작할 1개를 캘린더에 박아둡니다.', seconds: 60 },
      ],
      forbidden: '퇴근 직전에 새 업무를 시작하지 않습니다.',
      tags: ['퇴근전', '미완료정리', '첫행동', '캘린더', '잔상감소'],
   },
   {
      id: 'LEAVE_3M_002',
      title: '퇴근 전 ‘내일 첫 10분’ 예약 3분',
      situation: 'before_leave',
      duration_min: 3,
      type: 'planning',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '내일 시작 장벽을 낮춰 마음이 편해집니다.',
      steps: [
         { text: '내일 첫 10분 작업을 정합니다.', seconds: 60 },
         { text: '필요한 파일/링크를 미리 열어두거나 즐겨찾기합니다.', seconds: 60 },
         { text: '첫 문장/첫 줄을 미리 써둡니다.', seconds: 60 },
      ],
      forbidden: '내일 계획을 과하게 세우지 않습니다.',
      tags: ['퇴근전', '내일준비', '첫10분', '링크정리', '시작장벽'],
   },
   {
      id: 'LEAVE_3M_003',
      title: '퇴근 전 감각 차단 3분(알림 종료)',
      situation: 'before_leave',
      duration_min: 3,
      type: 'sensory',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '퇴근 모드로 전환해 회복을 시작합니다.',
      steps: [
         { text: '업무 알림을 퇴근 시간 동안 끕니다.', seconds: 60 },
         { text: '화면을 닫고 1분 호흡합니다.', seconds: 60 },
         { text: '오늘 잘한 일 1개를 한 줄로 적습니다.', seconds: 60 },
      ],
      forbidden: '퇴근 중에 업무 채팅을 계속 확인하지 않습니다.',
      tags: ['퇴근전', '알림OFF', '전환', '호흡', '성취'],
   },
   {
      id: 'LEAVE_3M_004',
      title: '퇴근 전 몸 리셋 3분(고정 자세 해제)',
      situation: 'before_leave',
      duration_min: 3,
      type: 'movement',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '몸의 긴장을 풀어 퇴근 후 피로를 덜어냅니다.',
      steps: [
         { text: '가슴 열기 스트레칭 60초를 합니다.', seconds: 60 },
         { text: '목 옆 늘리기 좌우 30초씩 합니다.', seconds: 60 },
         { text: '가볍게 제자리 걷기 60초를 합니다.', seconds: 60 },
      ],
      forbidden: '무리한 스트레칭을 하지 않습니다.',
      tags: ['퇴근전', '스트레칭', '목어깨', '자세해제', '피로감소'],
   },
   {
      id: 'LEAVE_3M_005',
      title: '퇴근 전 ‘끝내기 문장’ 3분',
      situation: 'before_leave',
      duration_min: 3,
      type: 'cognitive',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '업무를 ‘끝났다’로 닫아 마음을 분리합니다.',
      steps: [
         { text: '오늘의 마무리 문장을 씁니다(예: 오늘은 여기까지).', seconds: 60 },
         { text: '내일의 시작 문장을 씁니다(예: 내일은 이것부터).', seconds: 60 },
         { text: '자리 정리를 1분만 하고 종료합니다.', seconds: 60 },
      ],
      forbidden: '끝내기 문장을 쓰고 다시 일을 열지 않습니다.',
      tags: ['퇴근전', '마무리', '경계설정', '잔상컷', '자리정리'],
   },
   {
      id: 'LEAVE_10M_001',
      title: '퇴근 전 10분 ‘업무 잔상 컷’(정리 루프)',
      situation: 'before_leave',
      duration_min: 10,
      type: 'cognitive',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'mid',
      purpose: '업무 생각이 집까지 따라오는 것을 줄입니다.',
      steps: [
         { text: '오늘 남은 걱정/할 일을 전부 적습니다.', seconds: 240 },
         { text: '내일 처리할 것 3개만 남기고 나머지는 보관합니다.', seconds: 180 },
         { text: '내일 일정에 1개만 배치하고 종료합니다.', seconds: 180 },
      ],
      forbidden: '걱정을 해결하려고 추가 작업을 하지 않습니다.',
      tags: ['퇴근전', '잔상컷', '내일3개', '일정배치', '마음분리'],
   },
   {
      id: 'LEAVE_10M_002',
      title: '퇴근 전 10분 ‘책상 리셋’(내일의 나를 돕기)',
      situation: 'before_leave',
      duration_min: 10,
      type: 'planning',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: false,
         walk_required: false,
         seat_ok: true,
         privacy_required: false,
      },
      effort: 'mid',
      purpose: '환경을 정리해 내일 시작 비용을 낮춥니다.',
      steps: [
         { text: '책상 위를 3구역(필수/보관/버림)으로 나눕니다.', seconds: 180 },
         { text: '필수 구역만 남기고 나머지를 치웁니다.', seconds: 240 },
         { text: '내일 첫 업무에 필요한 것 3개만 세팅합니다.', seconds: 180 },
      ],
      forbidden: '완벽한 정리를 목표로 하지 않습니다.',
      tags: ['퇴근전', '정리', '책상리셋', '내일세팅', '시작비용감소'],
   },
   {
      id: 'LEAVE_10M_003',
      title: '퇴근 전 10분 ‘하루 회복 리포트’(Pro 핵심 형태)',
      situation: 'before_leave',
      duration_min: 10,
      type: 'cognitive',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: true,
         walk_required: false,
         seat_ok: true,
         privacy_required: true,
      },
      effort: 'mid',
      purpose: '오늘의 패턴을 확인해 내일을 더 쉽게 만듭니다.',
      steps: [
         { text: '오늘 힘들었던 순간 2개를 적습니다.', seconds: 240 },
         { text: '도움이 됐던 루틴/행동 1개를 적습니다.', seconds: 180 },
         { text: '내일 반복 방지 행동 1개를 정합니다.', seconds: 180 },
      ],
      forbidden: '자기비난 문장으로 기록하지 않습니다.',
      tags: ['퇴근전', '리포트', '패턴', '반복방지', '자기비난금지'],
   },
   {
      id: 'LEAVE_10M_004',
      title: '퇴근 전 10분 ‘관계 정리’(메신저 잔상 줄이기)',
      situation: 'before_leave',
      duration_min: 10,
      type: 'emotion',
      environment: {
         quiet_ok: true,
         noise_ok: true,
         alone_required: true,
         walk_required: false,
         seat_ok: true,
         privacy_required: true,
      },
      effort: 'mid',
      purpose: '관계 스트레스를 정리해 퇴근 후 머리를 비웁니다.',
      steps: [
         { text: '오늘 걸렸던 대화 1개를 적습니다.', seconds: 180 },
         { text: '내가 통제 가능한 행동 1개만 적습니다.', seconds: 180 },
         { text: '내일 보낼 짧은 메시지 초안을 2줄로 써두고 종료합니다.', seconds: 240 },
      ],
      forbidden: '지금 즉시 해결하려고 대화를 다시 열지 않습니다.',
      tags: ['퇴근전', '관계', '메신저잔상', '통제가능', '2줄초안'],
   },
   {
      id: 'LEAVE_10M_005',
      title: '퇴근 전 10분 ‘이동 시작 루틴’(퇴근 모드 전환)',
      situation: 'before_leave',
      duration_min: 10,
      type: 'movement',
      environment: {
         quiet_ok: false,
         noise_ok: true,
         alone_required: false,
         walk_required: true,
         seat_ok: false,
         privacy_required: false,
      },
      effort: 'low',
      purpose: '퇴근 신호를 만들어 회복을 빠르게 시작합니다.',
      steps: [
         { text: '업무 알림을 끄고 이동 준비를 합니다.', seconds: 120 },
         { text: '5분 천천히 걸으며 호흡과 발걸음을 느낍니다.', seconds: 300 },
         { text: '집에 가서 할 ‘가벼운 회복 행동 1개’를 정합니다.', seconds: 180 },
      ],
      forbidden: '퇴근길에 업무 메신저를 열지 않습니다.',
      tags: ['퇴근전', '이동', '걷기', '전환', '회복행동'],
   },
];

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

function loadState() {
   try {
      const raw = localStorage.getItem(LS_KEY);
      if (!raw) return DEFAULT_STATE;
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_STATE, ...parsed };
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
   // 매우 단순한 MVP 로직(설명 가능/검증 가능)
   // energy(0~10), tension(0~10), overheat(0~10), noise(quiet/normal/loud), time(3/10/30), alone, walk
   const energy = Number(checkin.energy ?? 5);
   const tension = Number(checkin.tension ?? 5);
   const overheat = Number(checkin.overheat ?? 5);
   const noise = checkin.noise;

   const noiseScore = noise === 'loud' ? 8 : noise === 'normal' ? 5 : 2;

   const scores = {
      cognitive: clamp(overheat * 10 + (energy < 4 ? 5 : 0), 0, 100),
      movement: clamp(tension * 10 + (energy < 4 ? 5 : 0), 0, 100),
      sensory: clamp(noiseScore * 10 + (overheat > 6 ? 10 : 0), 0, 100),
      emotion: clamp((tension + overheat) * 6, 0, 100),
      planning: clamp((10 - energy) * 8 + (overheat > 6 ? 5 : 0), 0, 100),
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

   return ROUTINES.filter(r => {
      if (r.situation !== situation) return false;
      if (r.duration_min !== durationMin) return false;

      // 환경 제약 필터
      if (r.environment.walk_required && !walkable) return false;
      if (r.environment.alone_required && !alone) return false;
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

function Card({ title, desc, children, right }) {
   return (
      <div className="rounded-2xl border bg-white/70 shadow-sm p-4">
         <div className="flex items-start justify-between gap-3">
            <div>
               <div className="text-base font-semibold">{title}</div>
               {desc ? <div className="text-sm text-slate-600 mt-1">{desc}</div> : null}
            </div>
            {right}
         </div>
         {children ? <div className="mt-3">{children}</div> : null}
      </div>
   );
}

function Pill({ children }) {
   return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs border bg-slate-50">{children}</span>
   );
}

function PrimaryButton({ children, onClick, disabled }) {
   return (
      <button
         onClick={onClick}
         disabled={disabled}
         className={`w-full rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm ${
            disabled ? 'bg-slate-400' : 'bg-slate-900 hover:bg-slate-800'
         }`}>
         {children}
      </button>
   );
}

function SecondaryButton({ children, onClick }) {
   return (
      <button
         onClick={onClick}
         className="w-full rounded-xl px-4 py-3 text-sm font-semibold border bg-white hover:bg-slate-50">
         {children}
      </button>
   );
}

function Field({ label, children, hint }) {
   return (
      <div className="space-y-1">
         <div className="text-sm font-medium">{label}</div>
         {children}
         {hint ? <div className="text-xs text-slate-500">{hint}</div> : null}
      </div>
   );
}

function Select({ value, onChange, options }) {
   return (
      <select
         value={value}
         onChange={e => onChange(e.target.value)}
         className="w-full rounded-xl border px-3 py-2 bg-white">
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
      <label className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2 bg-white">
         <span className="text-sm">{label}</span>
         <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)} className="h-5 w-5" />
      </label>
   );
}

function NumberSlider({ value, onChange, min = 0, max = 10 }) {
   return (
      <div className="flex items-center gap-3">
         <input
            type="range"
            min={min}
            max={max}
            value={value}
            onChange={e => onChange(Number(e.target.value))}
            className="w-full"
         />
         <div className="w-10 text-right text-sm tabular-nums">{value}</div>
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
      <div className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur border-t">
         <div className="max-w-md mx-auto grid grid-cols-4">
            {tabs.map(t => (
               <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`py-3 text-xs font-semibold ${tab === t.key ? 'text-slate-900' : 'text-slate-500'}`}>
                  {t.label}
               </button>
            ))}
         </div>
      </div>
   );
}

export default function App() {
   const [app, setApp] = useState(() => (typeof window === 'undefined' ? DEFAULT_STATE : loadState()));
   const [screen, setScreen] = useState('welcome');
   const [tab, setTab] = useState('today');

   // flow state
   const [checkin, setCheckin] = useState({
      situation: 'afternoon_crash',
      timeSlot: 3,
      noise: 'normal',
      energy: 5,
      tension: 5,
      overheat: 5,
      alone: false,
      walkable: false,
   });

   const [selectedRoutineId, setSelectedRoutineId] = useState(null);
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

   const typeScores = useMemo(() => scoreTypes(checkin), [checkin]);

   const selectedRoutine = useMemo(() => ROUTINES.find(r => r.id === selectedRoutineId) ?? null, [selectedRoutineId]);

   const recommendations = useMemo(() => {
      const situation = checkin.situation;
      const durationMin = Number(checkin.timeSlot);
      const pool = filterRoutines({ situation, durationMin, checkin });

      // MVP: primary/secondary type를 우선 노출
      const primaryKey = typeScores.primary?.key;
      const secondaryKey = typeScores.secondary?.key;

      const byType = key => pool.filter(r => r.type === key);
      const a = primaryKey ? byType(primaryKey) : [];
      const b = secondaryKey ? byType(secondaryKey) : [];
      const rest = pool.filter(r => ![primaryKey, secondaryKey].includes(r.type));

      const merged = [...a, ...b, ...rest];
      const unique = Array.from(new Map(merged.map(r => [r.id, r])).values());

      return {
         pool: unique,
         top: unique.slice(0, 3),
      };
   }, [checkin, typeScores]);

   const [player, setPlayer] = useState({
      running: false,
      stepIndex: 0,
      stepRemaining: 0,
      totalRemaining: 0,
      startedAt: null,
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

            // 완료
            if (nextTotalRemaining <= 0) {
               clearInterval(tickRef.current);
               return { ...p, running: false, stepRemaining: 0, totalRemaining: 0 };
            }

            // 단계 전환
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

   function startRoutine(routineId) {
      const r = ROUTINES.find(x => x.id === routineId);
      if (!r) return;

      setSelectedRoutineId(routineId);
      setBeforeScore(5);
      setAfterScore(6);

      const total = r.steps.reduce((sum, s) => sum + s.seconds, 0);
      setPlayer({
         running: true,
         stepIndex: 0,
         stepRemaining: r.steps[0].seconds,
         totalRemaining: total,
         startedAt: Date.now(),
      });

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
         alone: false,
         walkable: false,
      });
      setScreen('welcome');
      setTab('today');
      setSelectedRoutineId(null);
      setPlayer({ running: false, stepIndex: 0, stepRemaining: 0, totalRemaining: 0, startedAt: null });
   }

   // --- REPORT ---
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
      for (const s of last7) {
         bySituation.set(s.situation, (bySituation.get(s.situation) ?? 0) + 1);
      }

      const topSituation = Array.from(bySituation.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

      return { last7Count: last7.length, avgDelta, topRoutines, topSituation };
   }, [app.sessions]);

   // --- UI ---
   if (screen === 'welcome') {
      return (
         <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <div className="max-w-md mx-auto px-4 py-10">
               <div className="text-sm font-semibold text-slate-500">업무 복구 MVP 테스트 공간</div>
               <div className="mt-2 text-3xl font-extrabold tracking-tight">15초 체크인 → 3분 실행</div>
               <div className="mt-3 text-slate-600">
                  진단/치료가 아닌 <b>웰니스 루틴 추천</b>입니다. 지금 가능한 환경과 시간에 맞춰 “바로 실행할 수 있는”
                  행동만 제공합니다.
               </div>

               <div className="mt-8 space-y-3">
                  <PrimaryButton
                     onClick={() => {
                        setScreen('consent');
                     }}>
                     시작하기
                  </PrimaryButton>
                  <SecondaryButton
                     onClick={() => {
                        setApp(a => ({ ...a, consented: true }));
                     }}>
                     빠른 체험(동의 화면 건너뛰기)
                  </SecondaryButton>
               </div>

               <div className="mt-8 text-xs text-slate-500 leading-relaxed">
                  * 본 프로토타입은 기능/문구/흐름 검증용입니다.
                  <br />* 민감할 수 있는 상태 정보는 최소만 수집하며, 설정에서 즉시 삭제할 수 있습니다.
               </div>
            </div>
         </div>
      );
   }

   if (screen === 'consent') {
      return (
         <div className="min-h-screen bg-slate-50">
            <div className="max-w-md mx-auto px-4 py-8">
               <div className="text-xl font-extrabold">데이터는 최소로, 통제는 사용자에게</div>
               <div className="mt-2 text-sm text-slate-600">
                  상태 체크(에너지/긴장/과열 등)를 바탕으로 “지금 가능한” 루틴을 추천합니다. 이 서비스는 진단·치료
                  목적이 아닌 웰니스 행동 추천 도구입니다.
               </div>

               <div className="mt-6 space-y-3">
                  <label className="flex items-start gap-3 rounded-xl border bg-white p-3">
                     <input type="checkbox" defaultChecked className="mt-1 h-5 w-5" readOnly />
                     <div>
                        <div className="text-sm font-semibold">필수) 서비스 이용을 위한 기본 동의</div>
                        <div className="text-xs text-slate-500">기능 제공을 위해 기본 정보 처리가 필요합니다.</div>
                     </div>
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border bg-white p-3">
                     <input type="checkbox" defaultChecked className="mt-1 h-5 w-5" readOnly />
                     <div>
                        <div className="text-sm font-semibold">필수) 상태 정보 수집·이용 동의</div>
                        <div className="text-xs text-slate-500">개인화 추천을 위해 최소 문항만 수집합니다.</div>
                     </div>
                  </label>
                  <label className="flex items-start gap-3 rounded-xl border bg-white p-3">
                     <input type="checkbox" className="mt-1 h-5 w-5" />
                     <div>
                        <div className="text-sm font-semibold">선택) 익명 통계 참여</div>
                        <div className="text-xs text-slate-500">개인 식별 없이 사용성 개선에만 활용합니다.</div>
                     </div>
                  </label>
               </div>

               <div className="mt-6 space-y-3">
                  <PrimaryButton
                     onClick={() => {
                        setApp(a => ({ ...a, consented: true }));
                     }}>
                     동의하고 시작
                  </PrimaryButton>
                  <SecondaryButton
                     onClick={() => {
                        setApp(a => ({ ...a, consented: true }));
                     }}>
                     익명 모드로 시작(추천)
                  </SecondaryButton>
               </div>

               <div className="mt-6 text-xs text-slate-500">설정에서 언제든 데이터를 삭제할 수 있습니다.</div>
            </div>
         </div>
      );
   }

   if (screen === 'player' && selectedRoutine) {
      const r = selectedRoutine;
      const step = r.steps[player.stepIndex];
      const done = !player.running && player.totalRemaining === 0;

      return (
         <div className="min-h-screen bg-slate-50">
            <div className="max-w-md mx-auto px-4 py-6 pb-24">
               <div className="flex items-center justify-between">
                  <button
                     onClick={() => {
                        stopRoutine();
                        setScreen('app');
                     }}
                     className="text-sm font-semibold text-slate-600">
                     ← 나가기
                  </button>
                  <div className="text-xs text-slate-500">{SITUATIONS.find(s => s.key === r.situation)?.label}</div>
               </div>

               <div className="mt-4 text-xl font-extrabold">{r.title}</div>
               <div className="mt-2 text-sm text-slate-600">{r.purpose}</div>

               <div className="mt-4 grid grid-cols-3 gap-2">
                  <Pill>{r.duration_min}분</Pill>
                  <Pill>{TYPES.find(t => t.key === r.type)?.label}</Pill>
                  <Pill>{r.effort === 'low' ? '쉬움' : '보통'}</Pill>
               </div>

               <div className="mt-6 rounded-2xl border bg-white p-4">
                  <div className="text-sm font-semibold text-slate-700">현재 단계</div>
                  <div className="mt-2 text-base font-semibold">{step?.text}</div>
                  <div className="mt-3 flex items-center justify-between text-sm">
                     <span className="text-slate-500">단계 남은 시간</span>
                     <span className="font-semibold tabular-nums">{formatTime(player.stepRemaining)}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between text-sm">
                     <span className="text-slate-500">전체 남은 시간</span>
                     <span className="font-semibold tabular-nums">{formatTime(player.totalRemaining)}</span>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                     <button
                        onClick={() => {
                           setPlayer(p => ({ ...p, running: !p.running }));
                        }}
                        className="rounded-xl px-4 py-3 text-sm font-semibold border bg-white hover:bg-slate-50">
                        {player.running ? '일시정지' : '계속'}
                     </button>
                     <button
                        onClick={stopRoutine}
                        className="rounded-xl px-4 py-3 text-sm font-semibold border bg-white hover:bg-slate-50">
                        중단
                     </button>
                  </div>

                  <div className="mt-4 text-xs text-slate-500">금지요소: {r.forbidden}</div>
               </div>

               {done ? (
                  <div className="mt-6 space-y-3">
                     <Card title="전/후 체감 기록" desc="정답은 없습니다. 방금 전과 비교만 해주세요.">
                        <div className="grid grid-cols-2 gap-3">
                           <Field label="실행 전(0~10)">
                              <NumberSlider value={beforeScore} onChange={setBeforeScore} />
                           </Field>
                           <Field label="실행 후(0~10)">
                              <NumberSlider value={afterScore} onChange={setAfterScore} />
                           </Field>
                        </div>
                        <div className="mt-3">
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
                        <div className="mt-4">
                           <PrimaryButton onClick={completeRoutineAndRate}>완료</PrimaryButton>
                        </div>
                     </Card>
                  </div>
               ) : (
                  <div className="mt-6">
                     <div className="rounded-2xl border bg-white p-4">
                        <div className="text-sm font-semibold">루틴 단계</div>
                        <ol className="mt-2 space-y-2">
                           {r.steps.map((s, idx) => (
                              <li
                                 key={idx}
                                 className={`text-sm ${idx === player.stepIndex ? 'font-semibold' : 'text-slate-600'}`}>
                                 {idx + 1}. {s.text} <span className="text-slate-400">({formatTime(s.seconds)})</span>
                              </li>
                           ))}
                        </ol>
                     </div>
                     {!player.running ? (
                        <div className="mt-3 text-xs text-slate-500">
                           타이머가 0이 되면 자동으로 기록 화면으로 이동합니다.
                        </div>
                     ) : null}
                  </div>
               )}

               {!done && player.totalRemaining === 0 && !player.running ? null : null}
            </div>
         </div>
      );
   }

   // --- Main app ---
   return (
      <div className="min-h-screen bg-slate-50 pb-24">
         <div className="max-w-md mx-auto px-4 py-6 space-y-4">
            <div className="flex items-start justify-between">
               <div>
                  <div className="text-sm font-semibold text-slate-500">업무 복구</div>
                  <div className="text-xl font-extrabold">지금 가능한 루틴</div>
               </div>
               <button
                  onClick={resetAll}
                  className="text-xs font-semibold rounded-full border px-3 py-2 bg-white hover:bg-slate-100"
                  title="로컬 데이터 초기화">
                  초기화
               </button>
            </div>

            {tab === 'today' ? (
               <>
                  <Card
                     title="15초 체크인"
                     desc="지금 상태와 환경을 입력하면 추천이 더 정확해집니다."
                     right={<Pill>체크인</Pill>}>
                     <div className="space-y-3">
                        <Field label="지금 상황">
                           <Select
                              value={checkin.situation}
                              onChange={v => setCheckin(c => ({ ...c, situation: v }))}
                              options={SITUATIONS.map(s => ({ value: s.key, label: s.label }))}
                           />
                        </Field>

                        <Field label="가능한 시간">
                           <div className="grid grid-cols-3 gap-2">
                              {[3, 10].map(m => (
                                 <button
                                    key={m}
                                    onClick={() => setCheckin(c => ({ ...c, timeSlot: m }))}
                                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                                       Number(checkin.timeSlot) === m ? 'bg-slate-900 text-white' : 'bg-white'
                                    }`}>
                                    {m}분
                                 </button>
                              ))}
                              <button
                                 disabled
                                 className="rounded-xl border px-3 py-2 text-sm font-semibold bg-slate-100 text-slate-400">
                                 30분(다음)
                              </button>
                           </div>
                           <div className="text-xs text-slate-500 mt-1">
                              현재 MVP는 3분/10분만 포함(30분은 다음 단계에서 추가).
                           </div>
                        </Field>

                        <Field label="환경(소음)">
                           <div className="grid grid-cols-3 gap-2">
                              {[
                                 { v: 'quiet', l: '조용함' },
                                 { v: 'normal', l: '보통' },
                                 { v: 'loud', l: '시끄러움' },
                              ].map(x => (
                                 <button
                                    key={x.v}
                                    onClick={() => setCheckin(c => ({ ...c, noise: x.v }))}
                                    className={`rounded-xl border px-3 py-2 text-sm font-semibold ${
                                       checkin.noise === x.v ? 'bg-slate-900 text-white' : 'bg-white'
                                    }`}>
                                    {x.l}
                                 </button>
                              ))}
                           </div>
                        </Field>

                        <div className="grid grid-cols-3 gap-3">
                           <Field label="에너지(0~10)">
                              <NumberSlider
                                 value={checkin.energy}
                                 onChange={v => setCheckin(c => ({ ...c, energy: v }))}
                              />
                           </Field>
                           <Field label="긴장(0~10)">
                              <NumberSlider
                                 value={checkin.tension}
                                 onChange={v => setCheckin(c => ({ ...c, tension: v }))}
                              />
                           </Field>
                           <Field label="과열(0~10)">
                              <NumberSlider
                                 value={checkin.overheat}
                                 onChange={v => setCheckin(c => ({ ...c, overheat: v }))}
                              />
                           </Field>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                           <Toggle
                              checked={checkin.alone}
                              onChange={v => setCheckin(c => ({ ...c, alone: v }))}
                              label="혼자 있음"
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
                     <div className="flex flex-wrap gap-2">
                        <Pill>근거: 과열/긴장/에너지/소음·제약 반영</Pill>
                        <Pill>
                           상황: {SITUATIONS.find(s => s.key === checkin.situation)?.label} · {checkin.timeSlot}분
                        </Pill>
                     </div>

                     <div className="mt-3 grid gap-2">
                        {recommendations.top.length ? (
                           recommendations.top.map(r => (
                              <button
                                 key={r.id}
                                 onClick={() => startRoutine(r.id)}
                                 className="text-left rounded-2xl border bg-white p-4 hover:bg-slate-50">
                                 <div className="flex items-center justify-between gap-2">
                                    <div className="font-semibold">{r.title}</div>
                                    <Pill>{TYPES.find(t => t.key === r.type)?.label}</Pill>
                                 </div>
                                 <div className="mt-1 text-sm text-slate-600">{r.purpose}</div>
                                 <div className="mt-2 text-xs text-slate-500">금지요소: {r.forbidden}</div>
                              </button>
                           ))
                        ) : (
                           <div className="text-sm text-slate-600">
                              현재 조건(상황/시간/환경 제약)에서 실행 가능한 루틴이 없습니다. <b>소음/혼자/걷기</b>{' '}
                              옵션을 바꿔보세요.
                           </div>
                        )}
                     </div>

                     <div className="mt-4 grid grid-cols-2 gap-2">
                        <SecondaryButton
                           onClick={() => {
                              // 가장 쉬운 3분 루틴 1개 바로 실행
                              const quick = recommendations.top[0]?.id;
                              if (quick) startRoutine(quick);
                           }}>
                           가장 쉬운 1개 실행
                        </SecondaryButton>
                        <SecondaryButton
                           onClick={() => {
                              setTab('routines');
                           }}>
                           전체 루틴 보기
                        </SecondaryButton>
                     </div>
                  </Card>

                  <Card title="테스트 안내" desc="이 프로토타입에서 검증할 핵심은 ‘다시 켜게 만드는 루프’입니다.">
                     <ul className="text-sm text-slate-700 space-y-1 list-disc pl-5">
                        <li>체크인 입력이 부담 없이 끝나는지(15초 체감)</li>
                        <li>추천이 ‘지금 당장 할 만한지’(실행률)</li>
                        <li>전/후 체감이 반복적으로 개선되는지(효과)</li>
                     </ul>
                  </Card>
               </>
            ) : null}

            {tab === 'routines' ? (
               <>
                  <Card
                     title="루틴 목록"
                     desc="현재는 3분/10분 일부 샘플만 포함되어 있습니다."
                     right={<Pill>{SITUATIONS.find(s => s.key === checkin.situation)?.label}</Pill>}>
                     <div className="grid gap-2">
                        {recommendations.pool.map(r => (
                           <button
                              key={r.id}
                              onClick={() => startRoutine(r.id)}
                              className="text-left rounded-2xl border bg-white p-4 hover:bg-slate-50">
                              <div className="flex items-center justify-between gap-2">
                                 <div className="font-semibold">{r.title}</div>
                                 <Pill>
                                    {r.duration_min}분 · {TYPES.find(t => t.key === r.type)?.label}
                                 </Pill>
                              </div>
                              <div className="mt-1 text-sm text-slate-600">{r.purpose}</div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                 {(r.tags ?? []).slice(0, 3).map(t => (
                                    <Pill key={t}>{t}</Pill>
                                 ))}
                              </div>
                           </button>
                        ))}
                     </div>
                  </Card>
                  <Card title="루틴 데이터 추가" desc="ROUTINES 배열에 JSON을 붙여 넣으면 바로 확장됩니다." />
               </>
            ) : null}

            {tab === 'report' ? (
               <>
                  <Card title="이번 주 복구 요약" desc="최근 7일 기준(프로토타입: localStorage 기반)">
                     <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-xl border bg-white p-3">
                           <div className="text-xs text-slate-500">세션 수</div>
                           <div className="text-lg font-extrabold tabular-nums">{report.last7Count}</div>
                        </div>
                        <div className="rounded-xl border bg-white p-3">
                           <div className="text-xs text-slate-500">평균 개선(Δ)</div>
                           <div className="text-lg font-extrabold tabular-nums">{report.avgDelta.toFixed(1)}</div>
                        </div>
                        <div className="rounded-xl border bg-white p-3">
                           <div className="text-xs text-slate-500">많이 온 상황</div>
                           <div className="text-sm font-extrabold">
                              {report.topSituation ? SITUATIONS.find(s => s.key === report.topSituation)?.label : '-'}
                           </div>
                        </div>
                     </div>

                     <div className="mt-4">
                        <div className="text-sm font-semibold">효과가 높았던 루틴 TOP 3</div>
                        <div className="mt-2 space-y-2">
                           {report.topRoutines.length ? (
                              report.topRoutines.map(r => (
                                 <div
                                    key={r.id}
                                    className="rounded-xl border bg-white p-3 flex items-center justify-between">
                                    <div>
                                       <div className="text-sm font-semibold">{r.title}</div>
                                       <div className="text-xs text-slate-500">실행 {r.count}회</div>
                                    </div>
                                    <Pill>평균 Δ {r.avgDelta.toFixed(1)}</Pill>
                                 </div>
                              ))
                           ) : (
                              <div className="text-sm text-slate-600">
                                 아직 기록이 없습니다. 루틴을 1개 실행해보세요.
                              </div>
                           )}
                        </div>
                     </div>
                  </Card>

                  <Card title="(예시) Pro 미리보기" desc="실제 결제/구독은 구현하지 않고, ‘가치’만 테스트합니다.">
                     <ul className="text-sm text-slate-700 space-y-1 list-disc pl-5">
                        <li>상황 프리셋(회의 전/오후 붕괴/막힘/퇴근 전) 원탭 실행</li>
                        <li>주간 리포트: 반복 시간대/방해요소/다음 주 자동 추천</li>
                     </ul>
                     <div className="mt-3 grid grid-cols-2 gap-2">
                        <SecondaryButton
                           onClick={() =>
                              alert(
                                 '(MVP) 결제는 아직 구현하지 않습니다.\n대신 ‘Pro 가치’가 필요한지 사용자 피드백을 받으세요.',
                              )
                           }>
                           Paywall 보기
                        </SecondaryButton>
                        <SecondaryButton onClick={() => alert('(MVP) 프리셋은 다음 단계에서 추가합니다.')}>
                           프리셋(예고)
                        </SecondaryButton>
                     </div>
                  </Card>

                  <Card title="최근 세션" desc="최신 10개">
                     <div className="space-y-2">
                        {(app.sessions ?? []).slice(0, 10).map(s => (
                           <div key={s.id} className="rounded-xl border bg-white p-3">
                              <div className="flex items-center justify-between">
                                 <div className="text-sm font-semibold">{s.routineTitle}</div>
                                 <Pill>Δ {Number(s.delta ?? 0).toFixed(0)}</Pill>
                              </div>
                              <div className="mt-1 text-xs text-slate-500">
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
                  <Card
                     title="알림(테스트용)"
                     desc="현재 프로토타입에서는 실제 푸시를 보내지 않고, 트리거 문구만 확인합니다.">
                     <div className="grid gap-2">
                        <SecondaryButton
                           onClick={() => alert('출근 전: ‘업무 시작 전 3분만 복구하면 오전 페이스가 달라집니다.’')}>
                           출근 전 문구
                        </SecondaryButton>
                        <SecondaryButton
                           onClick={() => alert('오후 붕괴: ‘오후 집중이 끊기는 시간입니다, 3분만 리셋해보세요.’')}>
                           오후 붕괴 문구
                        </SecondaryButton>
                     </div>
                  </Card>

                  <Card title="데이터" desc="로컬 저장(localStorage) 기반입니다.">
                     <div className="grid gap-2">
                        <SecondaryButton
                           onClick={() => {
                              const blob = new Blob([JSON.stringify(app, null, 2)], { type: 'application/json' });
                              const url = URL.createObjectURL(blob);
                              const a = document.createElement('a');
                              a.href = url;
                              a.download = 'recovery_mvp_export.json';
                              a.click();
                              URL.revokeObjectURL(url);
                           }}>
                           내 데이터 다운로드(JSON)
                        </SecondaryButton>
                        <SecondaryButton onClick={resetAll}>내 데이터 삭제(즉시)</SecondaryButton>
                     </div>
                  </Card>

                  <Card title="안전 안내" desc="이 앱은 웰니스 루틴 추천 도구입니다.">
                     <div className="text-sm text-slate-700 leading-relaxed">
                        상태가 매우 힘들다고 느껴지거나 일상 기능이 크게 흔들릴 때는, 주변의 도움을 요청하거나 전문적인
                        상담/진료를 고려해 주세요.
                     </div>
                  </Card>
               </>
            ) : null}
         </div>

         <TopNav tab={tab} setTab={setTab} />
      </div>
   );
}
