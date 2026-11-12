// 인증 메일 본문 (D-046, D-047, D-102): 기본색 제목, 큰 글씨 6자리 번호, 안내 문구. HTML 과 같은 내용의 텍스트 본문을 함께 만든다
const NOTICE = '5분 안에 입력해 주세요. 본인이 요청하지 않았다면 이 메일을 무시해 주세요.';

// purposeLabel: "회원가입", "아이디 찾기" 처럼 용도 문구 (코드에 정해 둔 값만 들어온다)
export function buildVerificationMail(purposeLabel, code) {
  const title = `${purposeLabel} 인증번호`;
  const html = `<!doctype html>
<html lang="ko">
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:'Malgun Gothic',sans-serif;color:#111827;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 20px;font-size:22px;color:#1FAA59;">[TODO] ${title}</h1>
    <p style="margin:0 0 8px;font-size:15px;">아래 인증번호를 입력해 주세요.</p>
    <p style="margin:0 0 20px;font-size:36px;font-weight:800;letter-spacing:8px;">${code}</p>
    <p style="margin:0;font-size:13px;color:#6B7280;">${NOTICE}</p>
  </div>
</body>
</html>`;
  const text = `[TODO] ${title}\n\n아래 인증번호를 입력해 주세요.\n\n${code}\n\n${NOTICE}`;
  return { subject: `[TODO] ${title}`, html, text };
}

const escapeHtml = (text) => String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 팀 초대 안내 메일 (api.md 6.7, D-009, D-102): 인증 메일과 같은 모양. 닉네임·팀 이름은 HTML 이스케이프한다
export function buildTeamInviteMail(senderNickname, teamName) {
  const text = `${senderNickname}님이 ${teamName} 팀에 초대했습니다. TODO 에 로그인한 뒤 왼쪽 위 알림(종 아이콘)에서 수락하거나 거절해 주세요.`;
  const html = `<!doctype html>
<html lang="ko">
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:'Malgun Gothic',sans-serif;color:#111827;">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:16px;padding:32px;">
    <h1 style="margin:0 0 20px;font-size:22px;color:#1FAA59;">[TODO] 팀 초대 안내</h1>
    <p style="margin:0;font-size:15px;line-height:1.6;">${escapeHtml(senderNickname)}님이 ${escapeHtml(teamName)} 팀에 초대했습니다. TODO 에 로그인한 뒤 왼쪽 위 알림(종 아이콘)에서 수락하거나 거절해 주세요.</p>
  </div>
</body>
</html>`;
  return { subject: '[TODO] 팀 초대 안내', html, text: `[TODO] 팀 초대 안내\n\n${text}` };
}
