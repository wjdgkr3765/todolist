// SOLAPI 문자(SMS) 발송 (D-168). API 키·발신번호는 환경 변수 SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER
import { SolapiMessageService } from 'solapi';
import { env } from './env.js';

let service = null;
let sendOverride = null;

// sms: { to, text }. to 는 010 으로 시작하는 숫자 11자리
export async function sendSms(sms) {
  if (sendOverride) {
    return sendOverride(sms);
  }
  if (!env.solapiApiKey || !env.solapiApiSecret || !env.solapiSender) {
    throw new Error('SOLAPI_NOT_CONFIGURED');
  }
  service ??= new SolapiMessageService(env.solapiApiKey, env.solapiApiSecret);
  const result = await service.send({ to: sms.to, from: env.solapiSender, text: sms.text });
  if ((result.failedMessageList ?? []).length > 0) {
    throw new Error('SOLAPI_MESSAGE_FAILED');
  }
}

// 테스트에서 실제 문자를 보내지 않도록 바꿔 끼운다 (null 이면 원래대로)
export function setSendSmsOverride(fn) {
  sendOverride = fn;
}
