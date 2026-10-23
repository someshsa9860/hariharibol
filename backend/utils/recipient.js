// Who a notification is for, as far as its wording goes: the first name it opens with
// ("Hari Bol Somesh") and the languages the app speaks to them. Pure, so the builders that
// have no database (utils/sloka-push.js) can use it; `notify.recipientOf(userId)` reads the row.

import { firstNameOf } from './chat-name.js';
import { appChain } from './language.js';

/** `user` needs `name` and `appLanguage`; either may be missing. */
export function recipientOf(user) {
  return { name: firstNameOf(user?.name), chain: appChain(user) };
}
