// What Sakha has noticed about the reader — their to see, switch off and delete. The profile itself is built by
// services/chat-profile.js after each message; clearing the chat does not clear it, deleting it here does.

import * as chatProfile from '../../services/chat-profile.js';
import { ok, noContent } from '../../utils/respond.js';

/** GET /api/app/chat/profile — everything stored, keywords included. */
export const get = async (req, res) => ok(res, await chatProfile.view(req.auth.user.id));

/** PATCH /api/app/chat/profile */
export const update = async (req, res) => ok(res, await chatProfile.setLearning(req.auth.user.id, req.valid.body.learning));

/** DELETE /api/app/chat/profile */
export const remove = async (req, res) => {
  await chatProfile.remove(req.auth.user.id);
  return noContent(res);
};
