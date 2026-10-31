// The worker container.
//
// Runs its own process, in its own Docker container, with no HTTP server. That
// separation is what stops a twenty-minute AI batch pass from competing with
// request handling for the same event loop, and it means the worker can be
// scaled — or restarted — without touching the API.
//
// It also owns the schedule: on boot it registers the repeatable jobs from
// config/cron.js. The API never does, so a rolling deploy of the API cannot
// duplicate or drop a schedule.

import { BOOK_IDS } from '../scripts/lib/claude-translate-source.js';
import { Worker } from 'bullmq';
import { bullConnection } from '../config/redis.js';
import { QUEUE_NAMES, queues } from '../jobs/index.js';
import { registerSchedules } from '../jobs/schedules.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import logger from '../config/logger.js';
import { translation } from '../config/translation.js';
import { reconcileRuns } from '../services/translation.js';

import slokaProcessor from '../jobs/processors/sloka.js';
import notificationProcessor from '../jobs/processors/notification.js';
import preferencesProcessor from '../jobs/processors/preferences.js';
import paymentProcessor from '../jobs/processors/payment.js';
import aiProcessor from '../jobs/processors/ai.js';
import maintenanceProcessor from '../jobs/processors/maintenance.js';
import contentProcessor from '../jobs/processors/content.js';
import translationProcessor, { abortActiveRuns, onJobFailed } from '../jobs/processors/translation.js';
import devopsProcessor from '../jobs/processors/devops.js';
import scenesProcessor, { abortActiveRuns as abortSceneRuns, onJobFailed as onSceneJobFailed } from '../jobs/processors/scenes.js';
import { reconcileRuns as reconcileSceneRuns } from '../services/scenes.js';
import etiquetteProcessor, { abortActiveRuns as abortEtiquetteRuns, onJobFailed as onEtiquetteJobFailed } from '../jobs/processors/etiquette.js';
import { reconcileRuns as reconcileEtiquetteRuns } from '../services/etiquette.js';
import quoteProcessor, { abortActiveRuns as abortQuoteRuns, onJobFailed as onQuoteJobFailed } from '../jobs/processors/quote.js';
import { reconcileRuns as reconcileQuoteRuns } from '../services/quote.js';
import calendarProcessor, { abortActiveRuns as abortCalendarRuns, onJobFailed as onCalendarJobFailed } from '../jobs/processors/calendar.js';
import { reconcileRuns as reconcileCalendarRuns } from '../services/calendar-translation.js';
import marketingProcessor, { abortActiveRuns as abortMarketingRuns, onJobFailed as onMarketingJobFailed } from '../jobs/processors/marketing.js';
import { reconcileRuns as reconcileMarketingRuns } from '../services/marketing-run.js';
import translationImportProcessor, { abortActiveRuns as abortTranslationImportRuns, onJobFailed as onTranslationImportJobFailed } from '../jobs/processors/translation-import.js';
import { reconcileImportRuns } from '../services/translation-import.js';
import narrationProcessor, { abortActiveRuns as abortNarrationRuns, onJobFailed as onNarrationJobFailed } from '../jobs/processors/narration.js';
import { reconcileRuns as reconcileNarrationRuns } from '../services/narration.js';

// One processor per queue. The queue name is the key, so worker/ and jobs/
// cannot disagree about which processor runs what.
const processors = {
  sloka: slokaProcessor,
  notification: notificationProcessor,
  preferences: preferencesProcessor,
  payment: paymentProcessor,
  ai: aiProcessor,
  maintenance: maintenanceProcessor,
  content: contentProcessor,
  translation: translationProcessor,
  scenes: scenesProcessor,
  narration: narrationProcessor,
  etiquette: etiquetteProcessor,
  quote: quoteProcessor,
  calendar: calendarProcessor,
  marketing: marketingProcessor,
  'translation-import': translationImportProcessor,
  devops: devopsProcessor,
};

// How many jobs of each kind may run at once.
//
// AI is deliberately 1: the passes are rate-limited by the provider anyway, and
// running several in parallel only means hitting that limit and retrying. The
// notification queue gets the most, because those jobs are short and mostly
// spent waiting on Firebase.
const CONCURRENCY = {
  sloka: 1,
  notification: 5,
  preferences: 1,
  payment: 2,
  ai: 1,
  maintenance: 1,
  // One export at a time per worker; the Redis lock covers several workers.
  content: 1,
  // One run at a time, however many workers there are (set again below as a queue-wide limit): they
  // are hours long, bill by the call, and two languages at once only meet the same rate limit sooner.
  translation: 1,
  // One run at a time: the free tier's limits are per project, so two runs would only meet them sooner.
  scenes: 1,
  // One narration run at a time: each verse is billed by the call, and one book's runs share one engine rate limit.
  narration: 1,
  // One translation run at a time: they are billed by the call.
  etiquette: 1,
  quote: 1,
  // One calendar translation run at a time, for the same reason.
  calendar: 1,
  // One campaign at a time: they share one sender, one rate and one daily cap.
  marketing: 1,
  // Not a provider call, just per-chapter database writes — no shared rate limit the way the AI
  // runs above have, so a few languages can import at once.
  'translation-import': 3,
  // Short jobs; a few at once so a burst of events does not queue behind a health check.
  devops: 3,
};

const workers = [];
let reconcileTimer = null;
let reconcileScenesTimer = null;
let reconcileNarrationTimer = null;
let reconcileEtiquetteTimer = null;
let reconcileQuoteTimer = null;
let reconcileCalendarTimer = null;
let reconcileMarketingTimer = null;
let reconcileImportRunsTimer = null;

async function start() {
  await connectDatabase();

  for (const name of QUEUE_NAMES) {
    const worker = new Worker(name, processors[name], {
      connection: bullConnection,
      concurrency: CONCURRENCY[name] || 1,
      // A translation run whose worker died is handed to another many times over; the others, once.
      ...((name === 'translation' || name === 'scenes' || name === 'narration' || name === 'etiquette' || name === 'quote' || name === 'calendar' || name === 'marketing' || name === 'translation-import') && { maxStalledCount: translation.maxStalledCount }),
    });

    worker.on('completed', (job, result) => {
      logger.info({ queue: name, job: job.name, id: job.id, result }, 'job completed');
    });

    worker.on('failed', (job, err) => {
      logger.error(
        { queue: name, job: job?.name, id: job?.id, attempt: job?.attemptsMade, err: err.message },
        'job failed'
      );
      if (name === 'translation') {
        onJobFailed(job, err).catch((e) => logger.error({ err: e.message }, 'could not record a failed translation job'));
      }
      if (name === 'scenes') {
        onSceneJobFailed(job, err).catch((e) => logger.error({ err: e.message }, 'could not record a failed scenes job'));
      }
      if (name === 'narration') {
        onNarrationJobFailed(job, err).catch((e) => logger.error({ err: e.message }, 'could not record a failed narration job'));
      }
      if (name === 'etiquette') {
        onEtiquetteJobFailed(job, err).catch((e) => logger.error({ err: e.message }, 'could not record a failed etiquette job'));
      }
      if (name === 'quote') {
        onQuoteJobFailed(job, err).catch((e) => logger.error({ err: e.message }, 'could not record a failed quote job'));
      }
      if (name === 'calendar') {
        onCalendarJobFailed(job, err).catch((e) => logger.error({ err: e.message }, 'could not record a failed calendar job'));
      }
      if (name === 'marketing') {
        onMarketingJobFailed(job, err).catch((e) => logger.error({ err: e.message }, 'could not record a failed marketing job'));
      }
      if (name === 'translation-import') {
        onTranslationImportJobFailed(job, err).catch((e) => logger.error({ err: e.message }, 'could not record a failed translation import job'));
      }
    });

    worker.on('error', (err) => {
      logger.error({ queue: name, err: err.message }, 'worker error');
    });

    workers.push(worker);
    logger.info({ queue: name, concurrency: CONCURRENCY[name] }, 'worker started');
  }

  // One run at a time per book (the processor makes a second run of the same book wait), so both books can be translated together.
  await queues.translation.setGlobalConcurrency(BOOK_IDS.length);

  // Runs live in the database; their jobs live in Redis. If the two disagree (Redis was flushed, a job was
  // lost), put the run back in the queue. Once now, then every couple of minutes.
  const reconcile = () => reconcileRuns().catch((err) => logger.error({ err: err.message }, 'translation reconcile failed'));
  await reconcile();
  reconcileTimer = setInterval(reconcile, translation.reconcileEveryMs);
  const reconcileScenes = () => reconcileSceneRuns().catch((err) => logger.error({ err: err.message }, 'scenes reconcile failed'));
  await reconcileScenes();
  reconcileScenesTimer = setInterval(reconcileScenes, translation.reconcileEveryMs);
  const reconcileNarration = () => reconcileNarrationRuns().catch((err) => logger.error({ err: err.message }, 'narration reconcile failed'));
  await reconcileNarration();
  reconcileNarrationTimer = setInterval(reconcileNarration, translation.reconcileEveryMs);
  const reconcileEtiquette = () => reconcileEtiquetteRuns().catch((err) => logger.error({ err: err.message }, 'etiquette reconcile failed'));
  await reconcileEtiquette();
  reconcileEtiquetteTimer = setInterval(reconcileEtiquette, translation.reconcileEveryMs);
  const reconcileQuote = () => reconcileQuoteRuns().catch((err) => logger.error({ err: err.message }, 'quote reconcile failed'));
  await reconcileQuote();
  reconcileQuoteTimer = setInterval(reconcileQuote, translation.reconcileEveryMs);
  const reconcileCalendar = () => reconcileCalendarRuns().catch((err) => logger.error({ err: err.message }, 'calendar reconcile failed'));
  await reconcileCalendar();
  reconcileCalendarTimer = setInterval(reconcileCalendar, translation.reconcileEveryMs);
  const reconcileMarketing = () => reconcileMarketingRuns().catch((err) => logger.error({ err: err.message }, 'marketing reconcile failed'));
  await reconcileMarketing();
  reconcileMarketingTimer = setInterval(reconcileMarketing, translation.reconcileEveryMs);
  const reconcileImports = () => reconcileImportRuns().catch((err) => logger.error({ err: err.message }, 'translation import reconcile failed'));
  await reconcileImports();
  reconcileImportRunsTimer = setInterval(reconcileImports, translation.reconcileEveryMs);

  await registerSchedules();
  logger.info('worker ready');
}

// Jobs in flight are allowed to finish. Killing a half-written sloka build
// leaves some users with tomorrow's verse and some without.
async function shutdown(signal) {
  logger.info({ signal }, 'worker shutting down');
  clearInterval(reconcileTimer);
  clearInterval(reconcileScenesTimer);
  clearInterval(reconcileNarrationTimer);
  clearInterval(reconcileEtiquetteTimer);
  clearInterval(reconcileQuoteTimer);
  clearInterval(reconcileCalendarTimer);
  clearInterval(reconcileMarketingTimer);
  clearInterval(reconcileImportRunsTimer);
  // A translation run is hours long, so it is not waited out: it stops after its current call, puts
  // itself back in the queue, and the next worker carries on from the verse after the last one saved.
  const stopped = abortActiveRuns('shutdown');
  const stoppedScenes = abortSceneRuns('shutdown');
  const stoppedNarration = abortNarrationRuns('shutdown');
  const stoppedEtiquette = abortEtiquetteRuns('shutdown');
  const stoppedQuotes = abortQuoteRuns('shutdown');
  const stoppedCalendar = abortCalendarRuns('shutdown');
  const stoppedMarketing = abortMarketingRuns('shutdown');
  const stoppedImports = abortTranslationImportRuns('shutdown');
  if (stopped || stoppedScenes || stoppedNarration || stoppedEtiquette || stoppedQuotes || stoppedCalendar || stoppedMarketing || stoppedImports) {
    logger.info({ stopped, stoppedScenes, stoppedNarration, stoppedEtiquette, stoppedQuotes, stoppedCalendar, stoppedMarketing, stoppedImports }, 'translation, scene, narration, etiquette, calendar and import runs handed back to the queue');
  }
  await Promise.all(workers.map((worker) => worker.close()));
  await disconnectDatabase();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

start().catch((err) => {
  logger.error({ err }, 'worker failed to start');
  process.exit(1);
});
