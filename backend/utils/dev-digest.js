// The one line a digest push shows. Pure, so `npm test` loads it on its own.

const DIGEST_LABELS = {
  'user.signup': ['new sign-up', 'new sign-ups'],
  'ticket.new': ['new ticket', 'new tickets'],
  'feedback.new': ['new feedback', 'new feedback'],
  'ticket.reply': ['ticket reply', 'ticket replies'],
  'chat.message': ['message', 'messages'],
  'error.new': ['new error', 'new errors'],
  'error.spike': ['error spike', 'error spikes'],
  'health.alert': ['server alert', 'server alerts'],
};

export function summary(items) {
  const counts = new Map();
  for (const item of items) counts.set(item.type, (counts.get(item.type) || 0) + 1);
  return [...counts.entries()]
    .map(([type, n]) => {
      const [one, many] = DIGEST_LABELS[type] || ['event', 'events'];
      return `${n} ${n === 1 ? one : many}`;
    })
    .join(', ');
}

