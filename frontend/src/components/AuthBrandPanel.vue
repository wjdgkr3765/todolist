<!-- 인증 화면 왼쪽 브랜드 영역 (SignupView_screen.md 2. 레이아웃). 로그인 화면과 함께 쓴다 -->
<template>
  <section class="brand-panel" aria-hidden="true">
    <div class="brand-logo">
      <span class="brand-logo-mark"><i class="bi bi-check2-square"></i></span>
      TODO
    </div>
    <div class="brand-copy">
      <div class="brand-headline">함께 세우는 일정,<br />한눈에 보이는 진행</div>
      <div class="brand-desc">팀원과 할 일을 나누고, 칸반보드와 캘린더로<br />진행 상황을 실시간으로 확인하세요.</div>
      <ul class="brand-features">
        <li><span class="brand-feature-icon"><i class="bi bi-kanban"></i></span>대기 · 진행 · 완료 칸반보드</li>
        <li><span class="brand-feature-icon"><i class="bi bi-calendar3"></i></span>기간이 보이는 캘린더</li>
        <li><span class="brand-feature-icon"><i class="bi bi-people"></i></span>팀원과 실시간 협업</li>
      </ul>
      <div class="brand-board">
        <div class="brand-board-col"><span class="brand-board-title">대기</span><span class="brand-board-card"></span><span class="brand-board-card is-short is-dim"></span></div>
        <div class="brand-board-col"><span class="brand-board-title">진행</span><span class="brand-board-card"></span><span class="brand-board-card is-short"></span><span class="brand-board-card is-dim"></span></div>
        <div class="brand-board-col"><span class="brand-board-title">완료</span><span class="brand-board-card is-dim"></span></div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.brand-panel {
  position: relative; overflow: hidden; color: #fff; padding: 48px 44px;
  background: linear-gradient(150deg, var(--color-brand-from) 0%, var(--color-brand-to) 100%);
  display: flex; flex-direction: column;
}
.brand-panel::before, .brand-panel::after {
  content: ''; position: absolute; border-radius: 50%; background: rgba(255, 255, 255, 0.08);
}
.brand-panel::before { width: 340px; height: 340px; right: -120px; top: -100px; }
.brand-panel::after { width: 260px; height: 260px; left: -90px; bottom: -80px; }
.brand-logo { display: flex; align-items: center; gap: 10px; font-weight: 800; font-size: 22px; letter-spacing: 0.5px; position: relative; z-index: 1; }
.brand-logo-mark { width: 36px; height: 36px; border-radius: 10px; background: rgba(255, 255, 255, 0.18); display: grid; place-items: center; font-size: 20px; }
.brand-copy { margin-top: auto; position: relative; z-index: 1; }
.brand-headline { font-size: 30px; line-height: 1.35; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 12px; }
.brand-desc { font-size: 15px; line-height: 1.6; color: rgba(255, 255, 255, 0.82); margin-bottom: 28px; }
.brand-features { list-style: none; padding: 0; margin: 0 0 8px; display: grid; gap: 12px; }
.brand-features li { display: flex; align-items: center; gap: 12px; font-size: 15px; font-weight: 500; }
.brand-feature-icon { width: 34px; height: 34px; border-radius: 10px; background: rgba(255, 255, 255, 0.16); display: grid; place-items: center; font-size: 16px; flex: 0 0 auto; }

.brand-board { position: relative; z-index: 1; margin-top: 36px; display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.brand-board-col { background: rgba(255, 255, 255, 0.12); border-radius: 10px; padding: 8px; display: grid; gap: 6px; align-content: start; min-height: 92px; }
.brand-board-title { font-size: 11px; font-weight: 700; color: rgba(255, 255, 255, 0.85); }
.brand-board-card { height: 18px; border-radius: 6px; background: rgba(255, 255, 255, 0.85); }
.brand-board-card.is-short { width: 70%; }
.brand-board-card.is-dim { background: rgba(255, 255, 255, 0.45); }

@media (max-width: 991.98px) {
  .brand-panel { padding: 28px 28px 24px; }
  .brand-panel::before { width: 220px; height: 220px; right: -80px; top: -90px; }
  .brand-panel::after { display: none; }
  .brand-copy { margin-top: 18px; }
  .brand-headline { font-size: 22px; margin-bottom: 6px; }
  .brand-desc { font-size: 14px; margin-bottom: 0; }
  .brand-features, .brand-board { display: none; }
}
@media (max-width: 575.98px) {
  .brand-panel { padding: 22px 20px 20px; }
  .brand-headline { font-size: 19px; }
}
</style>
