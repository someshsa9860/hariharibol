// The nightly entitlement sweep.
//
// Webhooks are the primary way entitlement changes, and they are reliable
// enough that this rarely finds anything. It exists for the cases they cannot
// cover: a subscription whose period simply ran out with no event to announce
// it, and a webhook that was dropped while the API was restarting.
//
// It grants nothing on its own — it recomputes from the ledger, so a bug here
// can at worst be corrected by running it again.

const logger = require('../../config/logger');
const entitlement = require('../../services/entitlement');

module.exports = async function paymentProcessor(job) {
  switch (job.name) {
    case 'entitlement.sweep': {
      const result = await entitlement.sweep();
      logger.info(result, 'entitlement sweep finished');
      return result;
    }

    default:
      throw new Error(`Unknown payment job: ${job.name}`);
  }
};
