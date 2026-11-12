// Gmail SMTP 메일 발송 (D-004). 보낸 사람 이름은 "TODO", 주소는 MAIL_USER (D-047)
import nodemailer from 'nodemailer';
import { env } from './env.js';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: { user: env.mailUser, pass: env.mailPassword },
});

let sendOverride = null;

// mail: { to, subject, html, text }
export async function sendMail(mail) {
  if (sendOverride) {
    return sendOverride(mail);
  }
  await transporter.sendMail({ from: { name: 'TODO', address: env.mailUser }, ...mail });
}

// 테스트에서 실제 메일을 보내지 않도록 바꿔 끼운다 (null 이면 원래대로)
export function setSendMailOverride(fn) {
  sendOverride = fn;
}
