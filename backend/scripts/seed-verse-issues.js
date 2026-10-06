// Verse-to-vikara links, for the six mood chips on the home tab (kama,
// krodha, lobha, moha, mada, matsarya — see `Issue` in schema.prisma).
//
//   npm run seed:verse-issues
//
// This is deliberately NOT the AI batch pass (`jobs/processors/ai.js`
// `issueMap`). That job guesses at scale over the whole corpus with a model;
// this file never calls a model. Every row below was found and checked by
// one of two methods, both against the Bhaktivedanta Book Trust text already
// imported into this database (Śrīla Prabhupāda's Bhagavad-gītā As It Is and
// Śrīmad-Bhāgavatam, the same `prabhupada` translator seeded in
// prisma/seed/data.js, per the project's devotee-commentator-only content
// rule) — the imported `Verse.transliteration` and `VerseTranslation.meaning`
// columns ARE the primary source, so checking against them is checking
// against vedabase/prabhupadabooks itself, not a paraphrase of it:
//
//   TERM   — the verse's own transliteration contains the actual Sanskrit
//            word for the vikara (kāma, krodha, lobha, moha, mada, matsarya)
//            or one of the handful of established synonyms already used in
//            the first pass of this file (darpa/dambha for mada, parigraha
//            for lobha, mūḍha for moha, asūyā for matsarya). Every TERM
//            candidate was pulled by searching the whole imported BG+SB
//            corpus for that word, then read in English to confirm the word
//            is actually being used in the sense of the vice — not a name
//            that happens to share the letters ("Krodhavaśā", a daughter of
//            Dakṣa), a "mad-" prefix meaning "My" (mad-bhakta, "My devotee"
//            — grammatically unrelated to mada), or a Rājasūya sacrifice
//            mention (unrelated to āsūyā, envy, despite the shared letters).
//            All of those false matches were checked for and thrown out.
//   STORY  — a named narrative episode in the Bhāgavatam whose events turn on
//            that vikara, confirmed by reading the actual verses (not a
//            summary), even where the specific English word Prabhupāda chose
//            differs verse to verse. Cited by the pivotal verses in the
//            episode, not by every verse in the chapter.
//
// Both are still "no guess": a TERM row is never included on the strength of
// a stray substring match alone (see the false-positive list above), and a
// STORY row is never included on the strength of a chapter summary alone —
// only on having read the cited verses.
//
// Keyed by `Verse.verseId` (the human-readable "1.{chapter}.{verse}" /
// "2.{canto}.{chapter}.{verse}" key), never by the database id — a cuid is
// generated at insert time and is a different value on every environment,
// so hardcoding one here would make this file meaningless outside the
// database it was copied from. verseId is stable because it is derived from
// the scripture's own numbering, and it is what a person checking this file
// against a printed Gita or Bhagavatam can actually verify.
//
// Idempotent: re-running upserts the same rows and does not duplicate or
// drop anything. Safe to run in every environment, same as `npm run seed` —
// this is reference content, not demo data (contrast `seed-reels.js`, which
// invents accounts and is development-only).
//
// Depends on the verse content already being imported (`node
// scripts/import-bg.js`, `node scripts/import-sb.js` per scripts/README.md)
// and the issue taxonomy already being seeded (`npm run seed`). A verseId or
// issue slug that is not found is logged and skipped rather than failing the
// whole run, so this stays resumable if it is ever run before the content
// pipeline has caught up.

import { prisma } from '../config/database.js';

const log = (...args) => console.log('  ', ...args); // eslint-disable-line no-console

// WEIGHT NOTES — mirrors the scale the AI batch pass uses (see
// jobs/processors/ai.js), extended for TERM/STORY breadth:
//   90-100  the verse names or defines the vikara outright, or is the single
//           most direct verse in its book on the subject.
//   70-89   the word (or an established synonym) is present and central —
//           a definitional teaching verse, or the pivotal verse of a story.
//   50-69   the word is genuinely present but the verse is a supporting
//           beat: one item in a longer list of vices, a secondary character
//           in a story, or a scene-setting verse rather than the climax.
// Nothing below 50 is included — an absent link is still better than a
// stretched one; a low weight here is not a stretch, it is an honest verse
// that just isn't carrying the vice on its own.

const LINKS = [
  // ── Kama — काम, lust/craving ──────────────────────────────────────────────
  // BG 3.37: Arjuna asks what impels a man to sin even unwillingly; Krishna's
  // whole answer is this one word. The most direct verse in the Gita.
  { verseId: '1.3.37', issue: 'kama', weight: 100 },
  // BG 2.62: the chain — contemplation → attachment → kama → krodha — starts
  // here, naming kama as the hinge between the two.
  { verseId: '1.2.62', issue: 'kama', weight: 95 },
  // SB 9.19.14: King Yayati, after a thousand years of borrowed youth spent
  // chasing it, on why lust is never satisfied by indulging it — "like ghee
  // poured on fire." The Bhagavatam's own verdict on kama, from experience.
  { verseId: '2.9.19.14', issue: 'kama', weight: 95 },
  // BG 16.21: kama named as the first of the three gates to hell.
  { verseId: '1.16.21', issue: 'kama', weight: 90 },
  // BG 3.39: "kama-rupena" — the eternal enemy in the form of lust, covering
  // the living entity's pure consciousness "like fire covered by smoke."
  { verseId: '1.3.39', issue: 'kama', weight: 95 },
  // BG 2.70: "kamah... kama-kami" — the sthita-prajna verse: desires enter the
  // peaceful person as rivers enter the ever-full ocean without disturbing it;
  // only one who still chases kama is denied that peace. The word appears
  // twice in the verse itself.
  { verseId: '1.2.70', issue: 'kama', weight: 90 },
  // SB 7.15.22: Narada to Yudhishthira — kama is conquered by determination,
  // not by feeding it.
  { verseId: '2.7.15.22', issue: 'kama', weight: 85 },
  // BG 5.23: "kama-krodha-udbhavam vegam" — the urge born of lust AND anger,
  // named together in one compound; shared with krodha below.
  { verseId: '1.5.23', issue: 'kama', weight: 85 },
  // BG 3.41: "enam... papmanam" — "curb this symbol of sin" — continues the
  // teaching 3.37-3.39 name as kama; not a fresh word but the same passage's
  // conclusion (regulate the senses, then kill it).
  { verseId: '1.3.41', issue: 'kama', weight: 80 },
  // BG 6.24: "sankalpa-prabhavan kaman... tyaktva" — give up all desires born
  // of mental concoction, through yoga practice. Names kama directly, but as
  // one instruction among several for meditation rather than kama's own verse.
  { verseId: '1.6.24', issue: 'kama', weight: 72 },
  // TERM — BG 16.12: "kama-krodha-parayanah" — bound by hundreds of ties of
  // hope, devoted to lust and anger, hoarding wealth by unjust means.
  { verseId: '1.16.12', issue: 'kama', weight: 82 },
  // TERM — SB 3.12.26: from Brahma's own body at creation — lust from his
  // heart, anger from his brows, greed from his lips. Shared with krodha/lobha.
  { verseId: '2.3.12.26', issue: 'kama', weight: 78 },
  // TERM — SB 5.6.5: Rishabhadeva's teaching — "the mind is the root cause of
  // lust, anger, pride, greed, lamentation, illusion and fear." One verse
  // naming five of the six vikaras; shared across those sections below.
  { verseId: '2.5.6.5', issue: 'kama', weight: 85 },
  // TERM — SB 7.8.10: Prahlada on those who never "conquered the six enemies
  // that steal away the wealth of the body" — the shad-ripu itself, named as
  // a set. Shared across all six vikara sections.
  { verseId: '2.7.8.10', issue: 'kama', weight: 78 },
  // TERM — SB 11.25.2-5: Krishna to Uddhava on the three modes — "material
  // desire" listed as a defining quality of the mode of passion.
  { verseId: '2.11.25.2-5', issue: 'kama', weight: 75 },
  // TERM — SB 9.8.25: "hearts bewildered by lust, greed, envy and illusion."
  { verseId: '2.9.8.25', issue: 'kama', weight: 72 },
  // TERM — SB 9.8.26: freed from lusty desires simply by seeing the Lord.
  { verseId: '2.9.8.26', issue: 'kama', weight: 68 },

  // STORY — Ajamila (SB 6.1-6.2): a brahmana's fall, driven by lust for a
  // prostitute, into a lifetime of sin — and his deliverance at death, when
  // he cried out his son's name "Narayana" with no devotional intent at all,
  // and was saved regardless. The Bhagavatam's own case study that kama can
  // ruin a life, and that the holy name reaches even someone who fell to it.
  // SB 6.1.21: the fall itself, named plainly.
  { verseId: '2.6.1.21', issue: 'kama', weight: 85 },
  // SB 6.1.22: what that fall cost — a life of cheating and violence to
  // maintain the household it led to.
  { verseId: '2.6.1.22', issue: 'kama', weight: 55 },
  // SB 6.1.27: the turning point, decades later, at the hour of death.
  { verseId: '2.6.1.27', issue: 'kama', weight: 60 },
  // SB 6.1.30: the Vishnudutas arrive on hearing the name he called out.
  { verseId: '2.6.1.30', issue: 'kama', weight: 55 },
  // SB 6.2.49: the resolution — saved despite the chanting being directed at
  // his son, not the Lord. Mercy exceeding the sin that lust led him into.
  { verseId: '2.6.2.49', issue: 'kama', weight: 70 },

  // STORY — Pururava and Urvashi (SB 9.14): a king's romantic obsession with
  // a celestial dancer, who leaves him; his lament and eventual release.
  // SB 9.14.23: Pururava praising her, still enchanted.
  { verseId: '2.9.14.23', issue: 'kama', weight: 65 },
  // SB 11.26.7: the same king (as "Aila"), later, naming what happened to
  // him as delusion — shared with moha below.
  { verseId: '2.11.26.7', issue: 'kama', weight: 55 },

  // ── Krodha — क्रोध, anger ──────────────────────────────────────────────────
  // BG 2.63: krodhad bhavati sammohah — anger's own consequence chain
  // (delusion, lost memory, ruined intellect, downfall), spelled out in one
  // verse. The Gita's most cited anger verse.
  { verseId: '1.2.63', issue: 'krodha', weight: 100 },
  // BG 3.37: kama, thwarted, becomes krodha — the same verse anchoring kama
  // above also names krodha directly.
  { verseId: '1.3.37', issue: 'krodha', weight: 95 },
  // BG 5.23: whoever can withstand the force of kama-krodha before death is
  // called a yogi — anger named as one of the two urges to be checked.
  { verseId: '1.5.23', issue: 'krodha', weight: 90 },
  // BG 16.21: krodha named as the second gate to hell.
  { verseId: '1.16.21', issue: 'krodha', weight: 90 },
  // SB 7.15.22: krodha conquered by giving up the pursuit of sense
  // gratification that gives rise to it.
  { verseId: '2.7.15.22', issue: 'krodha', weight: 85 },
  // BG 16.4: krodha listed among the demoniac qualities, alongside harshness
  // and ignorance — one of six traits named, not krodha's own verse.
  { verseId: '1.16.4', issue: 'krodha', weight: 70 },
  // TERM — BG 2.56: the sthita-prajna description — free from attachment,
  // fear and anger. The complementary virtue-verse to 2.63 above.
  { verseId: '1.2.56', issue: 'krodha', weight: 78 },
  // TERM — BG 5.26: "krodha-vimuktanam" — liberation named for those free of
  // anger and material desire, self-realised and self-disciplined.
  { verseId: '1.5.26', issue: 'krodha', weight: 80 },
  // TERM — BG 16.2: freedom from anger listed among the daivi-sampad, the
  // divine qualities — the positive counterpart to 16.4's demoniac list.
  { verseId: '1.16.2', issue: 'krodha', weight: 72 },
  // TERM — BG 16.12: "kama-krodha-parayanah" — see kama above; the same verse
  // names both.
  { verseId: '1.16.12', issue: 'krodha', weight: 82 },
  // TERM — BG 18.53: anger listed among the qualities renounced for
  // self-realisation, alongside egoism and force.
  { verseId: '1.18.53', issue: 'krodha', weight: 72 },
  // TERM — SB 3.12.26: anger from Brahma's own brows at creation. Shared with
  // kama/lobha above.
  { verseId: '2.3.12.26', issue: 'krodha', weight: 78 },
  // TERM — SB 4.8.3: the genealogy of vice — "from Dambha and Maya were born
  // Greed... from their combination came children named Krodha (Anger) and
  // Himsa." Krodha named as a figure in its own right, not just a quality.
  { verseId: '2.4.8.3', issue: 'krodha', weight: 85 },
  // TERM — SB 5.6.5: Rishabhadeva's teaching. Shared across five vikaras.
  { verseId: '2.5.6.5', issue: 'krodha', weight: 82 },
  // TERM — SB 7.8.10: the shad-ripu verse. Shared across all six.
  { verseId: '2.7.8.10', issue: 'krodha', weight: 78 },
  // TERM — SB 7.13.34: give up anger among the causes of lamentation, fear
  // and attachment — Narada's counsel on renunciation.
  { verseId: '2.7.13.34', issue: 'krodha', weight: 75 },
  // TERM — SB 8.6.25: Vishnu to the demigods before the churning of the
  // ocean — "you should not be greedy... nor should you be angry."
  { verseId: '2.8.6.25', issue: 'krodha', weight: 60 },
  // TERM — SB 11.4.11: ascetics who cross the ocean of penance through severe
  // austerity, then drown "in a cow's hoofprint" — undone by useless anger.
  { verseId: '2.11.4.11', issue: 'krodha', weight: 82 },
  // TERM — SB 11.17.20: lust, anger and hankering named as qualities of the
  // lowest social order, in Krishna's own varnashrama teaching to Uddhava.
  { verseId: '2.11.17.20', issue: 'krodha', weight: 78 },
  // TERM — SB 11.17.21: its counterpart — freedom from lust, anger and greed
  // named as the duty of the twice-born.
  { verseId: '2.11.17.21', issue: 'krodha', weight: 78 },
  // TERM — SB 11.21.20: "from quarrel arises intolerable anger, followed by
  // the darkness of ignorance" — a short causal chain, echoing BG 2.63.
  { verseId: '2.11.21.20', issue: 'krodha', weight: 85 },
  // TERM — SB 11.23.18-19: anger named in a longer list of vices (theft,
  // violence, pride, envy...) describing a particular combination of modes.
  { verseId: '2.11.23.18-19', issue: 'krodha', weight: 68 },
  // TERM — SB 11.25.2-5: "intolerant anger" named as a defining quality of
  // the mode of ignorance, in the same three-modes teaching as above.
  { verseId: '2.11.25.2-5', issue: 'krodha', weight: 78 },
  // TERM — SB 11.28.15: anger listed among the experiences of false ego, not
  // of the self.
  { verseId: '2.11.28.15', issue: 'krodha', weight: 68 },
  // TERM — SB 12.5.1: "from whose anger Rudra takes birth" — Sukadeva's own
  // closing description of the Lord, cosmological rather than instructive.
  { verseId: '2.12.5.1', issue: 'krodha', weight: 60 },

  // STORY — Daksha's anger at Shiva (SB 4.2-4.7): a father-in-law's rage over
  // a perceived insult escalates to Sati's death and Virabhadra's destruction
  // of Daksha's own sacrifice — anger's cost measured in a family and a yajna.
  // SB 6.5.35: Daksha's anger at Narada, the seed of the conflict.
  { verseId: '2.6.5.35', issue: 'krodha', weight: 55 },
  // SB 4.5.1: Shiva's grief and fury on hearing of Sati's death.
  { verseId: '2.4.5.1', issue: 'krodha', weight: 65 },

  // STORY — Brahma's anger becomes Rudra (SB 3.12): when his sons refuse his
  // order, Brahma's suppressed anger has nowhere to go — and Rudra is born
  // from it, matching Sukadeva's remark at SB 12.5.1 above.
  { verseId: '2.3.12.6', issue: 'krodha', weight: 65 },

  // STORY — Bhrigu tests the Trimurti (SB 10.89): to see which of the three
  // guna-deities is least reactive, the sage deliberately provokes each; here
  // he tests Brahma, whose anger flares in response.
  { verseId: '2.10.89.3', issue: 'krodha', weight: 55 },

  // STORY — the Yadu dynasty's mutual destruction at Prabhasa (SB 11.30): the
  // Lord's own kinsmen, bewildered and cursed, turn on each other in the rage
  // that ends the Yadu line — anger as a civilisation-ending force, not a
  // personal failing only.
  { verseId: '2.11.30.14', issue: 'krodha', weight: 55 },
  { verseId: '2.11.30.24', issue: 'krodha', weight: 60 },

  // STORY — minor narrative beats where a character's anger is the point of
  // the verse, without carrying a larger teaching arc on its own.
  // SB 9.15.27: Parashurama, hearing of Kartaviryarjuna's theft, "as angry as
  // a trampled snake."
  { verseId: '2.9.15.27', issue: 'krodha', weight: 60 },
  // SB 9.18.34: Devayani, in the Yayati saga (see kama's story above from the
  // same cycle of events), "frenzied with anger" at Sarmishtha's pregnancy.
  { verseId: '2.9.18.34', issue: 'krodha', weight: 55 },
  // SB 10.16.38: Kaliya the serpent, "controlled by anger," yet still
  // graced — anger does not disqualify one from the Lord's mercy.
  { verseId: '2.10.16.38', issue: 'krodha', weight: 60 },
  // SB 10.36.12: Aristasura the bull demon charges Krishna "in a mindless
  // rage."
  { verseId: '2.10.36.12', issue: 'krodha', weight: 50 },

  // ── Lobha — लोभ, greed ─────────────────────────────────────────────────────
  // BG 14.17: lobha named as what specifically arises from the mode of
  // passion — its direct scriptural definition.
  { verseId: '1.14.17', issue: 'lobha', weight: 90 },
  // BG 16.21: lobha named as the third gate to hell.
  { verseId: '1.16.21', issue: 'lobha', weight: 90 },
  // SB 7.15.22: lobha given up by weighing how much trouble wealth actually
  // brings.
  { verseId: '2.7.15.22', issue: 'lobha', weight: 85 },
  // BG 18.53: "parigraham" — possessiveness over property — named among the
  // qualities to renounce for self-realisation. A synonym for lobha, not the
  // word itself, so weighted below the direct citations above.
  { verseId: '1.18.53', issue: 'lobha', weight: 70 },
  // TERM — BG 1.38: "lobhopahata-cetasah" — Arjuna on Duryodhana's side:
  // "hearts overtaken by greed," seeing no wrong in destroying a family for a
  // kingdom. The word itself, at the Gita's very opening.
  { verseId: '1.1.38', issue: 'lobha', weight: 92 },
  // TERM — BG 14.12: greed named among the symptoms of an increase in the
  // mode of passion, alongside intense endeavour and fruitive activity.
  { verseId: '1.14.12', issue: 'lobha', weight: 75 },
  // TERM — SB 1.2.19: lust, greed and the other effects of passion and
  // ignorance recede as loving service becomes established in the heart.
  { verseId: '2.1.2.19', issue: 'lobha', weight: 68 },
  // TERM — SB 1.14.5: Yudhishthira, reading the omens of Kali-yuga's onset —
  // people "became accustomed to greed, anger, pride."
  { verseId: '2.1.14.5', issue: 'lobha', weight: 70 },
  // TERM — SB 1.15.37: Yudhishthira again, on "increasing avarice,
  // falsehood" as reasons to renounce the throne.
  { verseId: '2.1.15.37', issue: 'lobha', weight: 65 },
  // TERM — SB 3.12.26: greed from Brahma's own lips at creation. Shared with
  // kama/krodha above.
  { verseId: '2.3.12.26', issue: 'lobha', weight: 78 },
  // TERM — SB 3.23.3: Devahuti, Kapila's mother, "giving up all lust, pride,
  // envy, greed" to please her husband — one verse naming four vikaras.
  { verseId: '2.3.23.3', issue: 'lobha', weight: 75 },
  // TERM — SB 3.25.16: Kapila's teaching to Devahuti — cleansed "of the
  // impurities of lust and greed" born of false bodily identification.
  { verseId: '2.3.25.16', issue: 'lobha', weight: 78 },
  // TERM — SB 3.30.11: a materialist, ruined in his own occupation, "accepts
  // money from others because of excessive greed."
  { verseId: '2.3.30.11', issue: 'lobha', weight: 60 },
  // TERM — SB 4.24.66: Prithu's own prayer — "the greed for material
  // enjoyment is always existing in the living entity," met in time by death.
  { verseId: '2.4.24.66', issue: 'lobha', weight: 80 },
  // TERM — SB 5.6.5: Rishabhadeva's teaching. Shared across five vikaras.
  { verseId: '2.5.6.5', issue: 'lobha', weight: 82 },
  // TERM — SB 7.8.10: the shad-ripu verse. Shared across all six.
  { verseId: '2.7.8.10', issue: 'lobha', weight: 78 },
  // TERM — SB 8.6.25: "you should not be greedy for them" — Vishnu to the
  // demigods, on the products of the churned ocean. Shared with krodha above.
  { verseId: '2.8.6.25', issue: 'lobha', weight: 70 },
  // TERM — SB 10.4.27: material qualities of "differentiation" — lamentation,
  // envy, greed, illusion — named as a set.
  { verseId: '2.10.4.27', issue: 'lobha', weight: 72 },
  // TERM — SB 10.51.49: a man "intensely greedy," delighting in sense
  // enjoyment, suddenly confronted by death — Kalayavana's own account.
  { verseId: '2.10.51.49', issue: 'lobha', weight: 65 },
  // TERM — SB 10.73.12-13: kings "blinded by the intoxication of riches,"
  // fighting each other to acquire more. Shared with mada below.
  { verseId: '2.10.73.12-13', issue: 'lobha', weight: 65 },
  // TERM — SB 11.7.29: "burning in the great forest fire of lust and greed" —
  // Krishna to Uddhava, on the ordinary condition of the world.
  { verseId: '2.11.7.29', issue: 'lobha', weight: 78 },
  // TERM — SB 11.17.21: freedom from lust, anger and greed as duty. Shared
  // with krodha above.
  { verseId: '2.11.17.21', issue: 'lobha', weight: 75 },
  // TERM — SB 11.23.16: "whatever pure fame is possessed... is destroyed by
  // even a small amount of greed, just as beauty is ruined by a trace of
  // leprosy" — one of the sharpest single images in the corpus for lobha.
  { verseId: '2.11.23.16', issue: 'lobha', weight: 85 },
  // TERM — SB 11.25.2-5: "dissatisfaction even in gain" named for the mode of
  // passion — greed's own restlessness.
  { verseId: '2.11.25.2-5', issue: 'lobha', weight: 65 },
  // TERM — SB 11.28.15: greed listed among the experiences of false ego.
  { verseId: '2.11.28.15', issue: 'lobha', weight: 65 },
  // TERM — SB 12.3.29: Kali-yuga's approach marked by "greed, dissatisfaction,
  // false pride, hypocrisy and envy" becoming prominent.
  { verseId: '2.12.3.29', issue: 'lobha', weight: 72 },

  // STORY — a guru's own greed (SB 9.13.5): Maharaja Nimi's spiritual master
  // curses him over a scheduling dispute rooted in wanting Indra's
  // contribution for himself first — even a great teacher is shown fallible
  // to lobha, with real consequences for both men.
  { verseId: '2.9.13.5', issue: 'lobha', weight: 55 },

  // STORY — King Vena (SB 4.13-4.14): a king so consumed by his own opulence
  // that he halts Vedic sacrifice altogether, wanting the offerings for
  // himself — greed as state policy, not just a private vice. Shared with the
  // mada story below, since the Bhagavatam names both in him.
  { verseId: '2.4.14.5', issue: 'lobha', weight: 65 },

  // ── Moha — मोह, delusion/attachment ────────────────────────────────────────
  // BG 2.63: sammohah — the same verse anchoring krodha above; delusion is
  // named as anger's first casualty, in the Gita's central verse on it.
  { verseId: '1.2.63', issue: 'moha', weight: 100 },
  // BG 18.7: renunciation carried out "mohat" — out of delusion — is
  // condemned outright as ignorance. Moha named directly.
  { verseId: '1.18.7', issue: 'moha', weight: 95 },
  // SB 7.15.23: "soka-mohau" — lamentation and delusion — conquered by
  // discussing spiritual knowledge.
  { verseId: '2.7.15.23', issue: 'moha', weight: 90 },
  // BG 14.17: moha (as "mohau") named as arising, with negligence, from the
  // mode of ignorance.
  { verseId: '1.14.17', issue: 'moha', weight: 80 },
  // BG 7.15: "mudhah" — the deluded — one of four kinds of people who do not
  // surrender. Same root as moha, describing the person rather than naming
  // the state itself, so weighted as a secondary link.
  { verseId: '1.7.15', issue: 'moha', weight: 65 },
  // TERM — BG 2.52: intelligence "passed out of the dense forest of
  // delusion" — the verse right before 2.56, on what clears moha.
  { verseId: '1.2.52', issue: 'moha', weight: 78 },
  // TERM — BG 3.2: Arjuna himself — "my intelligence is bewildered by Your
  // equivocal instructions" — the confusion that opens the Gita's teaching.
  { verseId: '1.3.2', issue: 'moha', weight: 60 },
  // TERM — BG 7.27: "all living entities are born into delusion, bewildered
  // by dualities arisen from desire and hate."
  { verseId: '1.7.27', issue: 'moha', weight: 82 },
  // TERM — BG 7.28: its resolution — freed from delusion by pious action
  // exhausting sinful reaction.
  { verseId: '1.7.28', issue: 'moha', weight: 70 },
  // TERM — BG 10.4: freedom from delusion listed among the qualities that
  // originate from Krishna alone.
  { verseId: '1.10.4', issue: 'moha', weight: 65 },
  // TERM — BG 14.8: "the mode of darkness, born of ignorance, is the delusion
  // of all embodied living entities" — moha's own scriptural definition.
  { verseId: '1.14.8', issue: 'moha', weight: 85 },
  // TERM — BG 14.13: "darkness, inertia, madness and illusion" manifest as
  // ignorance increases.
  { verseId: '1.14.13', issue: 'moha', weight: 75 },
  // TERM — BG 14.22: the transcendentalist neither hates nor desires
  // delusion, illumination or activity when they appear — moha as one of the
  // three modes' visible signs, to be witnessed rather than reacted to.
  { verseId: '1.14.22', issue: 'moha', weight: 65 },
  // TERM — BG 16.16: "bound by a network of illusions," attached to sense
  // enjoyment, falling into a hellish world.
  { verseId: '1.16.16', issue: 'moha', weight: 72 },
  // TERM — BG 18.39: happiness "blind to self-realization... delusion from
  // beginning to end" — the tamasic happiness.
  { verseId: '1.18.39', issue: 'moha', weight: 75 },
  // TERM — BG 18.72: Krishna's own question to Arjuna — "are your ignorance
  // and illusions now dispelled?" — setting up 18.73 below.
  { verseId: '1.18.72', issue: 'moha', weight: 70 },
  // TERM — BG 18.73: Arjuna's answer — "my illusion is now gone." The Gita's
  // own closing word on moha, spoken by the person it was taught to.
  { verseId: '1.18.73', issue: 'moha', weight: 88 },
  // TERM — SB 5.6.5: Rishabhadeva's teaching. Shared across five vikaras.
  { verseId: '2.5.6.5', issue: 'moha', weight: 78 },
  // TERM — SB 7.8.10: the shad-ripu verse. Shared across all six.
  { verseId: '2.7.8.10', issue: 'moha', weight: 78 },
  // TERM — SB 7.13.34: illusion named among the causes of lamentation and
  // fear to be given up. Shared with krodha above.
  { verseId: '2.7.13.34', issue: 'moha', weight: 75 },
  // TERM — SB 3.12.2: Brahma's "nescient engagements" at creation —
  // self-deception, the sense of false ownership, the illusory bodily
  // conception — named as a set, before krodha and the rest appear in 3.12.26.
  { verseId: '2.3.12.2', issue: 'moha', weight: 75 },
  // TERM — SB 7.2.37: Yamaraja's own amazement — people, who see others die
  // daily, still don't believe it will happen to them.
  { verseId: '2.7.2.37', issue: 'moha', weight: 70 },
  // TERM — SB 7.2.42: the false identification of self with one's house,
  // "as a householder... thinks his house to be identical with him."
  { verseId: '2.7.2.42', issue: 'moha', weight: 65 },
  // TERM — SB 5.11.16: "the mind is the cause of all tribulations" — as long
  // as this is unknown, one stays conditioned.
  { verseId: '2.5.11.16', issue: 'moha', weight: 55 },
  // TERM — SB 5.12.16: illusion cut through by association with exalted
  // devotees.
  { verseId: '2.5.12.16', issue: 'moha', weight: 65 },
  // TERM — SB 5.14.27: illusion and bewilderment named in a long list of
  // materialistic miseries. Shared with lobha/matsarya above.
  { verseId: '2.5.14.27', issue: 'moha', weight: 65 },
  // TERM — SB 8.16.19: Kasyapa to Diti — the material body, made of five
  // elements, is different from the spirit soul that misidentifies with it.
  { verseId: '2.8.16.19', issue: 'moha', weight: 50 },
  // TERM — SB 8.22.16: Prahlada on Bali — the very post of heavenly king "was
  // putting him in the darkness of ignorance" until it was mercifully removed.
  { verseId: '2.8.22.16', issue: 'moha', weight: 55 },
  // TERM — SB 8.24.25: King Satyavrata, "bewildered," on first hearing the
  // fish-avatar speak.
  { verseId: '2.8.24.25', issue: 'moha', weight: 50 },
  // TERM — SB 8.12.47: the Mohini-murti — the Lord "assuming the form of a
  // young woman and thus bewildering the demons" to protect the nectar for
  // His devotees. Moha as the Lord's own weapon, used to protect rather than
  // to trap.
  { verseId: '2.8.12.47', issue: 'moha', weight: 62 },
  // TERM — SB 9.8.25: hearts "bewildered by lust, greed, envy and illusion."
  // Shared with kama above.
  { verseId: '2.9.8.25', issue: 'moha', weight: 75 },
  // TERM — SB 9.8.26: freed of lusty desires — and their accompanying
  // illusion — simply by seeing the Lord.
  { verseId: '2.9.8.26', issue: 'moha', weight: 65 },
  // TERM — SB 10.4.27: material qualities including illusion. Shared with
  // lobha/matsarya above.
  { verseId: '2.10.4.27', issue: 'moha', weight: 68 },
  // TERM — SB 10.8.40: Mother Yashoda, wondering to herself whether what she
  // has just seen in Krishna's mouth is a dream or the Lord's illusory energy.
  { verseId: '2.10.8.40', issue: 'moha', weight: 55 },
  // TERM — SB 10.54.49: "with transcendental knowledge dispel the grief that
  // is weakening and confounding your mind."
  { verseId: '2.10.54.49', issue: 'moha', weight: 60 },
  // TERM — SB 10.77.31: lamentation, bewilderment, fear — all born of
  // ignorance — wrongly ascribed to the infinite Lord.
  { verseId: '2.10.77.31', issue: 'moha', weight: 65 },
  // TERM — SB 10.77.32: devotees dispel the bodily concept of life through
  // self-realisation and service.
  { verseId: '2.10.77.32', issue: 'moha', weight: 60 },
  // TERM — SB 11.11.2: material lamentation and illusion compared to a
  // dream — real to the dreamer, with no substance on waking.
  { verseId: '2.11.11.2', issue: 'moha', weight: 65 },
  // TERM — SB 11.18.25: renunciation and simple living named as a path out
  // of illusion, for the vanaprastha.
  { verseId: '2.11.18.25', issue: 'moha', weight: 60 },
  // TERM — SB 11.21.18: renunciation of a sinful activity frees one from its
  // bondage — the general principle behind escaping any of the vikaras.
  { verseId: '2.11.21.18', issue: 'moha', weight: 55 },
  // TERM — SB 11.22.33: false ego, in its three phases, arises when the
  // modes of nature are agitated.
  { verseId: '2.11.22.33', issue: 'moha', weight: 55 },
  // TERM — SB 11.25.2-5: delusion named as a major quality of the mode of
  // ignorance, in the same three-modes teaching cited above.
  { verseId: '2.11.25.2-5', issue: 'moha', weight: 78 },
  // TERM — SB 11.28.15: confusion listed among the experiences of false ego.
  { verseId: '2.11.28.15', issue: 'moha', weight: 65 },
  // TERM — SB 12.3.30: Kali-yuga's approach marked, among other things, by
  // bewilderment becoming prominent.
  { verseId: '2.12.3.30', issue: 'moha', weight: 65 },

  // STORY — Devahuti and Kapila (SB 3.25, 3.33): a mother's request for her
  // divine son to teach her the path beyond illusion, and her eventual
  // liberation. Shared with lobha above, since her renunciation names greed
  // by the same breath.
  { verseId: '2.3.25.10', issue: 'moha', weight: 72 },
  { verseId: '2.3.33.1', issue: 'moha', weight: 65 },

  // STORY — Puranjana (SB 4.25-4.29): Narada's allegory of a king enchanted
  // by a beautiful city of nine gates (the body) and its queen (the mind) —
  // the Bhagavatam's most extended single illustration of moha, told as an
  // entire reign rather than a moment.
  { verseId: '2.4.25.55', issue: 'moha', weight: 65 },
  { verseId: '2.4.29.16', issue: 'moha', weight: 65 },

  // STORY — a foolish attachment carried across a lifetime (SB 3.31.41): a
  // soul who, from attachment to a woman, is reborn as one, and mistakes her
  // own husband — himself a form of maya — for the source of her happiness.
  { verseId: '2.3.31.41', issue: 'moha', weight: 58 },

  // STORY — a son as "a bond of illusion" (SB 4.13.45): even a beloved child,
  // Prithu's own father is warned, can be nothing more than an attachment
  // that binds, if approached without discrimination.
  { verseId: '2.4.13.45', issue: 'moha', weight: 55 },

  // STORY — Pingala the prostitute (SB 11.8): a woman who spent a life
  // waiting up for wealthy clients realizes, in a single night, how
  // illusioned her whole pursuit of love and security has been — one of the
  // most direct first-person confessions of moha anywhere in the Bhagavatam.
  { verseId: '2.11.8.30', issue: 'moha', weight: 82 },
  { verseId: '2.11.8.31', issue: 'moha', weight: 75 },

  // STORY — Pururava and Urvashi, continued (SB 11.26): the same king from
  // kama's story above, later recounting his own infatuation as delusion, and
  // being freed of it after singing of his realization.
  { verseId: '2.11.26.7', issue: 'moha', weight: 68 },
  { verseId: '2.11.26.25', issue: 'moha', weight: 55 },

  // STORY — Uddhava's own resolution (SB 11.29): the Gita's closing arc
  // (Arjuna, 18.73 above) mirrored at the end of the Bhagavatam — Uddhava
  // confirms his illusion, too, is now dispelled.
  { verseId: '2.11.29.29', issue: 'moha', weight: 55 },
  { verseId: '2.11.29.37', issue: 'moha', weight: 80 },

  // ── Mada — मद, pride/vanity/intoxication ───────────────────────────────────
  // BG 16.17: "dhana-mana-madanvitah" — full of the mada bred by wealth and
  // false prestige. The word itself, in the Gita.
  { verseId: '1.16.17', issue: 'mada', weight: 100 },
  // SB 10.27.7: Indra, humbled after Govardhana, naming his own fall as
  // "tan-madam" — that false pride — in his own confession. The word itself,
  // spoken in the moment of recognising it.
  { verseId: '2.10.27.7', issue: 'mada', weight: 95 },
  // BG 16.4: "darpah" — arrogance — named among the demoniac qualities. A
  // synonym for mada, not the word itself.
  { verseId: '1.16.4', issue: 'mada', weight: 75 },
  // BG 18.53: "darpam" again, among the qualities renounced for
  // self-realisation.
  { verseId: '1.18.53', issue: 'mada', weight: 70 },
  // SB 7.15.23: "dambham" — false pride — overcome by serving a great
  // devotee. A synonym (dambha, hypocrisy-tinged pride) rather than mada
  // itself.
  { verseId: '2.7.15.23', issue: 'mada', weight: 65 },
  // TERM — BG 18.35: "madam eva ca" — the tamasic form of determination,
  // which does not go beyond dreaming, fear, lamentation and this same word
  // (rendered "illusion" in translation, mada in the Sanskrit itself).
  { verseId: '1.18.35', issue: 'mada', weight: 62 },
  // TERM — SB 1.8.26: "edhamana-madah" — pride that only increases with
  // material advancement, from Kunti's prayer.
  { verseId: '2.1.8.26', issue: 'mada', weight: 68 },
  // TERM — SB 3.9.3: "indriyatmaka-madah" — the pride/intoxication of the
  // bodily senses, contrasted with the Lord's own form.
  { verseId: '2.3.9.3', issue: 'mada', weight: 55 },
  // TERM — SB 3.23.3: Devahuti giving up pride, among other vices. Shared
  // with lobha/matsarya above.
  { verseId: '2.3.23.3', issue: 'mada', weight: 70 },
  // TERM — SB 5.6.5: Rishabhadeva's teaching. Shared across five vikaras.
  { verseId: '2.5.6.5', issue: 'mada', weight: 80 },
  // TERM — SB 7.8.10: the shad-ripu verse. Shared across all six.
  { verseId: '2.7.8.10', issue: 'mada', weight: 78 },
  // TERM — SB 8.22.24: "because of material opulence a foolish person
  // becomes dull" — Krishna to Brahma, on what wealth does to discrimination.
  { verseId: '2.8.22.24', issue: 'mada', weight: 72 },
  // TERM — SB 11.4.8: the Lord Himself, offended by Indra, "did not become
  // proud" in response — the contrast case, teaching by restraint.
  { verseId: '2.11.4.8', issue: 'mada', weight: 55 },
  // TERM — SB 11.23.18-19: pride named in the same vice-list as krodha above.
  { verseId: '2.11.23.18-19', issue: 'mada', weight: 65 },
  // TERM — SB 11.25.2-5: "false pride" named as a defining quality of the
  // mode of passion, in the same three-modes teaching cited throughout.
  { verseId: '2.11.25.2-5', issue: 'mada', weight: 78 },
  // TERM — SB 12.3.29: Kali-yuga's approach marked by "false pride" becoming
  // prominent, alongside greed and envy.
  { verseId: '2.12.3.29', issue: 'mada', weight: 70 },

  // STORY — Indra's pride and Govardhana (SB 10.25-10.27): the fullest
  // treatment of mada in the Bhagavatam — Indra's arrogance over his own
  // sacrifice, his failed attempt to punish Vraja with storms, and his
  // eventual surrender, already anchored above by his confession at 10.27.7.
  // SB 10.25.3: Indra, watching the cowherds, on their prosperity.
  { verseId: '2.10.25.3', issue: 'mada', weight: 68 },
  // SB 10.25.6: "the prosperity of these people has made them mad with
  // pride" — Indra's own diagnosis, aimed at Krishna's devotees, before it
  // turns out to describe himself.
  { verseId: '2.10.25.6', issue: 'mada', weight: 75 },
  // SB 10.25.16: Krishna's own remark — "demigods like Indra are proud of
  // their position."
  { verseId: '2.10.25.16', issue: 'mada', weight: 70 },
  // SB 10.27.3: Indra's false pride in being lord of the three worlds, once
  // he has seen Krishna's actual power.
  { verseId: '2.10.27.3', issue: 'mada', weight: 88 },
  // SB 10.27.8: "engrossed in pride over my ruling power, ignorant of Your
  // majesty, I offended You" — Indra's full confession, continuing 10.27.7.
  { verseId: '2.10.27.8', issue: 'mada', weight: 90 },
  // SB 10.29.48: Krishna, wanting to relieve the gopis of pride in their own
  // good fortune — a gentler register of the same lesson.
  { verseId: '2.10.29.48', issue: 'mada', weight: 60 },

  // STORY — King Vena (SB 4.14): the same king cited under lobha above —
  // "overly blind due to his opulences" and out of control "like an
  // uncontrolled elephant," a single figure the Bhagavatam uses for both
  // greed and pride together.
  { verseId: '2.4.14.5', issue: 'mada', weight: 68 },

  // STORY — kings undone by their own wealth (SB 10.73): rival kings,
  // "blinded by the intoxication of riches," destroy each other fighting to
  // acquire more — the political scale of mada, not just a personal failing.
  // Shared with lobha above.
  { verseId: '2.10.73.12-13', issue: 'mada', weight: 68 },

  // STORY — Diti's resentment of Indra's arrogance (SB 6.18): the seed of
  // Hiranyakashipu and Hiranyaksha's birth — Diti, watching Indra "consider
  // his body eternal" and grow "unrestrained," wants a son who can end his
  // pride by force. Pride in one generation begetting greater danger in the
  // next.
  { verseId: '2.6.18.26', issue: 'mada', weight: 55 },
  // SB 6.7.9: Brihaspati, seeing Indra's own transgression of etiquette
  // toward his guru — pride's smaller, earlier warning sign.
  { verseId: '2.6.7.9', issue: 'mada', weight: 55 },

  // ── Matsarya — मात्सर्य, envy ───────────────────────────────────────────────
  // SB 1.1.2: "nirmatsaranam" — the Bhagavatam names its own audience as
  // those who are completely free of matsarya. The word itself, in the
  // Bhagavatam's own second verse.
  { verseId: '2.1.1.2', issue: 'matsarya', weight: 100 },
  // BG 3.31: "anasuyantah" — free from envy — named as a condition, with
  // faith, for liberation from karma.
  { verseId: '1.3.31', issue: 'matsarya', weight: 95 },
  // BG 16.18: "abhyasuyakah" — the envious — describing the demoniac who
  // blaspheme the Lord within every body.
  { verseId: '1.16.18', issue: 'matsarya', weight: 85 },
  // SB 7.15.23: "himsam" here glossed by Prabhupada as envy, conquered by
  // giving up the pursuit of sense gratification. The gloss, not the literal
  // word matsarya, so weighted as a secondary link.
  { verseId: '2.7.15.23', issue: 'matsarya', weight: 65 },
  // TERM — BG 3.32: "out of envy" — the direct counterpart to 3.31 above:
  // those who disregard the teaching this way are bereft of knowledge.
  { verseId: '1.3.32', issue: 'matsarya', weight: 85 },
  // TERM — BG 9.1: Krishna's own reason for trusting Arjuna with this
  // teaching — "because you are never envious of Me."
  { verseId: '1.9.1', issue: 'matsarya', weight: 78 },
  // TERM — BG 18.67: this knowledge is never to be explained to one who is
  // envious — the condition on hearing it at all.
  { verseId: '1.18.67', issue: 'matsarya', weight: 55 },
  // TERM — BG 18.71: "one who listens with faith and without envy becomes
  // free from sinful reactions" — the Gita's own closing word on matsarya,
  // paired with 18.73's closing word on moha above.
  { verseId: '1.18.71', issue: 'matsarya', weight: 88 },
  // TERM — SB 3.23.3: Devahuti giving up envy. Shared with lobha/mada above.
  { verseId: '2.3.23.3', issue: 'matsarya', weight: 72 },
  // TERM — SB 3.29.8: devotional service performed by one who is "envious,
  // proud, violent and angry" is considered materially motivated, not pure.
  { verseId: '2.3.29.8', issue: 'matsarya', weight: 75 },
  // TERM — SB 4.8.3: "Himsa," born alongside Krodha in the genealogy of vice,
  // glossed by Prabhupada as envy here — the same verse cited under krodha.
  { verseId: '2.4.8.3', issue: 'matsarya', weight: 72 },
  // TERM — SB 5.14.27: envy named in the long list of materialistic
  // miseries. Shared with lobha/moha above.
  { verseId: '2.5.14.27', issue: 'matsarya', weight: 62 },
  // TERM — SB 7.8.10: the shad-ripu verse. Shared across all six.
  { verseId: '2.7.8.10', issue: 'matsarya', weight: 76 },
  // TERM — SB 10.86.55: "foolish people neglect and enviously offend a
  // learned brahmana" — the danger named plainly.
  { verseId: '2.10.86.55', issue: 'matsarya', weight: 78 },
  // TERM — SB 11.10.6: a disciple should be free of false prestige, and by
  // extension the rivalry it breeds — the weaker, contextual end of the link.
  { verseId: '2.11.10.6', issue: 'matsarya', weight: 50 },
  // TERM — SB 11.17.27: "one should not envy" the acharya, who is to be seen
  // as non-different from the Lord Himself.
  { verseId: '2.11.17.27', issue: 'matsarya', weight: 75 },
  // TERM — SB 11.18.39: continuing devotional service "without envy" until
  // spiritual knowledge is fully realised.
  { verseId: '2.11.18.39', issue: 'matsarya', weight: 68 },
  // TERM — SB 11.22.58-59: the flip side — remaining equipoised even when
  // "neglected, insulted, ridiculed or envied by bad men."
  { verseId: '2.11.22.58-59', issue: 'matsarya', weight: 55 },
  // TERM — SB 11.25.2-5: "violent hatred" named for the mode of ignorance, in
  // the same three-modes teaching cited throughout — envy's harsher cousin.
  { verseId: '2.11.25.2-5', issue: 'matsarya', weight: 62 },
  // TERM — SB 11.29.15: meditating on the Lord's presence within everyone
  // dissolves "the bad tendencies of rivalry, envy and abusiveness."
  { verseId: '2.11.29.15', issue: 'matsarya', weight: 80 },
  // TERM — SB 12.3.29: Kali-yuga's approach marked by envy becoming
  // prominent, alongside greed and false pride.
  { verseId: '2.12.3.29', issue: 'matsarya', weight: 72 },

  // STORY — King Vena (SB 4.14): asking the sages to set aside "your envy of
  // me" even as his own greed and pride (see those sections above) are what
  // actually provoked them.
  { verseId: '2.4.14.28', issue: 'matsarya', weight: 55 },

  // STORY — an angry, envious king toward a sage (SB 1.18.29): named plainly
  // as both anger and envy, provoked by hunger and thirst rather than any
  // real offense — a small failing with large consequences later in the same
  // narrative.
  { verseId: '2.1.18.29', issue: 'matsarya', weight: 60 },

  // STORY — Paundraka, the false Vasudeva (SB 10.66): a king so envious of
  // Krishna's position that he impersonates Him outright, and is killed for
  // it — envy taken to the point of imitation.
  { verseId: '2.10.66.23', issue: 'matsarya', weight: 55 },
];

async function main() {
  console.log('Seeding verse–mood links...\n'); // eslint-disable-line no-console

  const issues = await prisma.issue.findMany({ where: { category: 'VIKARA' } });
  const issueBySlug = new Map(issues.map((issue) => [issue.slug, issue]));
  if (!issueBySlug.size) {
    console.error('No VIKARA issues found. Run `npm run seed` first.'); // eslint-disable-line no-console
    process.exit(1);
  }

  const verseIds = [...new Set(LINKS.map((link) => link.verseId))];
  const verses = await prisma.verse.findMany({
    where: { verseId: { in: verseIds } },
    select: { id: true, verseId: true, isSlokaEligible: true },
  });
  const verseByVerseId = new Map(verses.map((verse) => [verse.verseId, verse]));

  let linked = 0;
  let skipped = 0;

  for (const link of LINKS) {
    const issue = issueBySlug.get(link.issue);
    const verse = verseByVerseId.get(link.verseId);

    if (!issue || !verse) {
      log(`skipped ${link.verseId} → ${link.issue} (${!verse ? 'verse' : 'issue'} not found)`);
      skipped += 1;
      continue;
    }

    await prisma.verseIssue.upsert({
      where: { verseId_issueId: { verseId: verse.id, issueId: issue.id } },
      update: { weight: link.weight },
      create: { verseId: verse.id, issueId: issue.id, weight: link.weight },
    });
    linked += 1;
  }

  // A verse curated here is, by definition, one an editor opted in for
  // "Sloka for You" — the picker only ever draws from isSlokaEligible verses
  // (see pickVerseForIssue in controllers/app/sloka.js), so a curated link
  // that does not also flip this flag would sit in VerseIssue and never be
  // served to anyone asking about the mood it answers.
  const notYetEligible = verses.filter((verse) => !verse.isSlokaEligible).map((verse) => verse.id);
  if (notYetEligible.length) {
    await prisma.verse.updateMany({
      where: { id: { in: notYetEligible } },
      data: { isSlokaEligible: true },
    });
  }

  log(`${linked} verse–mood links (${new Set(LINKS.map((l) => l.verseId)).size} verses, ${issueBySlug.size} moods)`);
  log(`${notYetEligible.length} verse(s) newly marked sloka-eligible`);
  if (skipped) log(`${skipped} link(s) skipped — see above`);

  console.log('\nDone.'); // eslint-disable-line no-console
}

main()
  .catch((err) => {
    console.error('Seed failed:', err); // eslint-disable-line no-console
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
