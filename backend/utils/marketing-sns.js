// Amazon SNS message authenticity, for the bounce / complaint webhook. Pure apart from the certificate the caller fetches:
// SNS signs every message with a certificate it hosts on amazonaws.com; we only ever fetch a certificate from there, and
// verify the signature over the fields SNS documents (https://docs.aws.amazon.com/sns/latest/dg/sns-verify-signature-of-message.html).

import crypto from 'node:crypto';

const FIELDS = {
  Notification: ['Message', 'MessageId', 'Subject', 'Timestamp', 'TopicArn', 'Type'],
  SubscriptionConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
  UnsubscribeConfirmation: ['Message', 'MessageId', 'SubscribeURL', 'Timestamp', 'Token', 'TopicArn', 'Type'],
};

/** The canonical text SNS signed: each field's name and value on lines, in alphabetical order, only the ones present. */
export function stringToSign(message) {
  const fields = FIELDS[message?.Type];
  if (!fields) return null;
  return fields
    .filter((name) => message[name] !== undefined && message[name] !== null)
    .map((name) => `${name}\n${message[name]}\n`)
    .join('');
}

const HOST = /^sns\.[a-z0-9-]+\.amazonaws\.com(\.cn)?$/;

/** Only an https certificate on an SNS host of Amazon's own may be fetched — never a URL the sender chose freely. */
export function validCertUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && HOST.test(url.hostname) && url.pathname.endsWith('.pem') && !url.port;
  } catch {
    return false;
  }
}

/** Only an https subscribe URL on an SNS host of Amazon's own is opened to confirm a subscription. */
export function validSubscribeUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'https:' && HOST.test(url.hostname) && !url.port;
  } catch {
    return false;
  }
}

/** Does `message.Signature` match, for the certificate in PEM? */
export function verifySignature(message, certPem) {
  const text = stringToSign(message);
  if (!text || !message.Signature) return false;
  const algorithm = message.SignatureVersion === '2' ? 'RSA-SHA256' : message.SignatureVersion === '1' ? 'RSA-SHA1' : null;
  if (!algorithm) return false;
  try {
    return crypto.createVerify(algorithm).update(text, 'utf8').verify(certPem, message.Signature, 'base64');
  } catch {
    return false;
  }
}

/**
 * What an SES event notification (the SNS `Message`, already parsed) says: a list of
 * `{ type: 'bounce'|'complaint'|'delivery', permanent, messageId, emails, detail }`, usually one.
 */
export function eventsOf(ses) {
  const type = ses?.eventType || ses?.notificationType;
  const messageId = ses?.mail?.messageId ?? null;
  if (type === 'Bounce') {
    const b = ses.bounce || {};
    return [{ type: 'bounce', permanent: b.bounceType === 'Permanent', messageId, emails: (b.bouncedRecipients || []).map((r) => r.emailAddress), detail: (b.bouncedRecipients || []).map((r) => r.diagnosticCode).filter(Boolean)[0] ?? `${b.bounceType ?? ''} ${b.bounceSubType ?? ''}`.trim() }];
  }
  if (type === 'Complaint') {
    const c = ses.complaint || {};
    return [{ type: 'complaint', permanent: true, messageId, emails: (c.complainedRecipients || []).map((r) => r.emailAddress), detail: c.complaintFeedbackType ?? 'complaint' }];
  }
  if (type === 'Delivery') {
    return [{ type: 'delivery', permanent: false, messageId, emails: ses.delivery?.recipients || [], detail: null }];
  }
  return [];
}
