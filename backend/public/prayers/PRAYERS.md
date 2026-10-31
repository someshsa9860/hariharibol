# Prayers

The prayers the app should carry, and where each one's original text came from. Written by
`scripts/fetch-prayers.js` from `scripts/lib/prayer-catalogue.js`; edit the catalogue, not this file, and run
`npm run fetch:prayers` again.

Nothing here is in the database or on S3 yet: the files in `json/` are the hand-over to an import.

## Where the texts came from

- **kksongs.org** (Kṛṣṇa Kīrtana Songs), for the Vaiṣṇava songs. Each song has a Roman, a Devanagari and a Bengali
  page, read one against the other. Only the lyrics are taken, never the English translation or the purport (the
  BBT's, under copyright). A Sanskrit song's text is its Devanagari; a Bengali song's is its Bengali, with the
  Devanagari kept beside it where the site has one. Both have the Roman beside them.
- **Wikisource** (Sanskrit), for the rest, read as wikitext through its API. The texts are centuries old and public
  domain; the pages are CC BY-SA 4.0, named in each file's `sourceName`. One copy, in Devanagari only, so these
  prayers have no Roman yet (`roman` is null): how it is written (IAST or the kksongs style) is the owner's call.
- **Not used**: sanskritdocuments.org (its FAQ forbids copying its texts in bulk for other sites or apps),
  stotranidhi.com (all rights reserved), vignanam.org (a bot check in front of its pages) and
  scsmathinternational.com (behind Cloudflare). Nothing was taken from behind a bot check.

Every typo put right is in the file's `edits`, with its reason, and a correction the page no longer needs stops the
run. **`meaning` is null everywhere**: the English on these sites is modern and under copyright, so meanings are
ours to write (or a translation run's). **No text has been read by someone who reads the script**; each needs that
before it is published.

## Status

- **fetched**: the copies agree, or there is one copy, and the verse numbers run 1, 2, 3 ….
- **fetched, check**: kksongs' Roman, Devanagari and Bengali copies differ in places; the differences are in the
  file's `checks.differences` and want reading once.
- **wanted, no source yet**: no copy free to reuse was found; why is under Notes.
- **excluded**: not to be published; why is under Notes.

## A prayer file

`json/<slug>.json`; `json/_index.json` lists every file with its title, category, language, verse count and checks.

| Field | What it holds |
|---|---|
| `slug`, `title`, `titleOriginal` | The title in English (with diacritics) and in the original's own script |
| `category`, `sortOrder` | As the `Prayer` model has them (`config/prayer.js`) |
| `originalLanguage` | A `config/prayer.js` language code (`sa`, `bn` …) |
| `summary`, `about` | Our own words |
| `author`, `reference` | As tradition gives them |
| `sourceName`, `sourceUrl` | Where the text came from, and its licence where it has one |
| `tradition`, `deity`, `occasions`, `festivals` | When and by whom it is said; `festivals` are `services/festivals.js` slugs |
| `verses[]` | `position`, `text` (the original script, lines split by `\n`), `roman`, `devanagari` (a Bengali song's), `meaning` (null) |
| `sourcePages`, `sourceHeader` | Every page read, and what the page itself says about the song |
| `edits` | Each correction made to the page's text, and why |
| `checks` | Verse counts per copy, lines dropped (headings, colophons, refrains), differences between copies, warnings |
| `fetchedAt` | When the file was written |

## The list

| Prayer | Original title | Category | Tradition | Verses | Festivals | Status |
|---|---|---|---|---|---|---|
| Śrī Gurvaṣṭakam | श्रीगुर्वष्टकम् | Guru | vaishnava | 9 | guru-purnima | fetched, check |
| Śrī Guru-caraṇa-padma | শ্রীগুরু-চরণ-পদ্ম | Guru | vaishnava | 10 | guru-purnima | fetched |
| Śrī Ṣaḍ-gosvāmy-aṣṭakam | श्रीषड्गोस्वाम्यष्टकम् | Guru | vaishnava | 8 |  | fetched |
| Je Ānilo Prema-dhana | যে আনিল প্রেমধন | Guru | vaishnava | 5 |  | fetched |
| Vibhāvarī Śeṣa | বিভাবরী শেষ | Morning | vaishnava | 8 |  | fetched |
| Udilo Aruṇa | উদিল অরুণ | Morning | vaishnava | 8 |  | fetched |
| Jīv Jāgo | জীব জাগ | Morning | vaishnava | 5 |  | fetched |
| Śrī Gaura Ārati | শ্রীগৌর-আরতি | Aarti | vaishnava | 7 |  | fetched |
| Śrī Tulasī Ārati | श्री तुलसी आरती | Aarti | vaishnava | 5 | tulsi-vivah | fetched |
| Śrī Bhoga Ārati | শ্রীভোগ-আরতি | Aarti | vaishnava | 17 |  | fetched |
| Prasāda-sevāya | প্রসাদ-সেবায় | Meals | vaishnava | 2 |  | fetched |
| Mahā-prasāde Govinde | महाप्रसादे गोविन्दे | Meals | vaishnava | 1 |  | fetched |
| Śrī Tulasī Kīrtana | শ্রীতুলসী-কীর্তন | Deity | vaishnava | 7 | tulsi-vivah | fetched |
| Śrī Nṛsiṁha Praṇāma | श्रीनृसिंहप्रणाम | Deity | vaishnava | 3 | narasimha-chaturdashi | fetched |
| Śrī Dāmodarāṣṭakam | श्रीदामोदराष्टकम् | Deity | vaishnava | 8 | sharad-purnima, kartika-purnima | fetched |
| Śrī Śikṣāṣṭakam | श्रीशिक्षाष्टकम् | Deity | vaishnava | 8 |  | fetched, check |
| Śrī Nāmāṣṭakam | श्रीनामाष्टकम् | Deity | vaishnava |  |  | wanted, no source yet |
| Hari Haraye Namaḥ | হরি হরয়ে নমঃ | Deity | vaishnava | 10 |  | fetched |
| Śrī Kṛṣṇa-caitanya Prabhu Doyā Koro More | শ্রীকৃষ্ণচৈতন্য প্রভু দয়া কর মোরে | Deity | vaishnava | 7 |  | fetched |
| Gopīnātha | গোপীনাথ | Deity | vaishnava | 8 |  | fetched |
| Śrī Daśāvatāra Stotra | श्रीदशावतारस्तोत्रम् | Deity | vaishnava | 12 |  | fetched |
| Śrī Rādhā-kṛpā-kaṭākṣa Stava-rāja | श्रीराधाकृपाकटाक्षस्तवराज | Deity | vaishnava | 13 | radhashtami | fetched |
| Śrī Jagannāthāṣṭakam | श्रीजगन्नाथाष्टकम् | Deity | vaishnava | 9 | rath-yatra | fetched, check |
| Madhurāṣṭakam | मधुराष्टकम् | Deity | vaishnava | 8 | janmashtami | fetched |
| Acyutam Keśavam | अच्युतं केशवम् | Deity | vaishnava | 8 |  | fetched |
| Śrī Govardhanāṣṭakam | श्रीगोवर्धनाष्टकम् | Deity | vaishnava | 9 | govardhan-puja | fetched |
| Gaurāṅga Bolite Habe | গৌরাঙ্গ বলিতে হবে | Deity | vaishnava | 5 |  | fetched |
| Jaya Rādhā-Mādhava | জয় রাধা-মাধব | Deity | vaishnava | 1 |  | fetched |
| Gītā-dhyānam | गीताध्यानम् | Other | smarta | 9 | gita-jayanti | fetched |
| Śrī Hari-vāsare | শ্রীহরিবাসরে | Other | vaishnava |  | ekadashi | wanted, no source yet |
| Bhaja Govindam | भज गोविन्दम् | Other | smarta | 34 |  | fetched |
| Pūrṇam Adaḥ | ॐ पूर्णमदः पूर्णमिदम् | Peace | smarta | 1 |  | fetched |
| Śiva Pañcākṣara Stotram | शिवपञ्चाक्षरस्तोत्रम् | Deity | shaiva | 6 | maha-shivaratri, pradosh | fetched |
| Liṅgāṣṭakam | लिङ्गाष्टकम् | Deity | shaiva | 9 | maha-shivaratri, pradosh | fetched |
| Śiva Tāṇḍava Stotram | शिवताण्डवस्तोत्रम् | Deity | shaiva | 17 | maha-shivaratri, pradosh | fetched |
| Śrī Rudrāṣṭakam | श्रीरुद्राष्टकम् | Deity | shaiva | 9 | maha-shivaratri, pradosh | fetched |
| Śiva Mānasa Pūjā | शिवमानसपूजा | Deity | shaiva | 4 | maha-shivaratri | fetched |
| Kara-caraṇa-kṛtam (forgive my faults) | करचरणकृतं वाक्कायजं | Evening | shaiva | 1 |  | fetched |
| Gaṇapati Atharvaśīrṣa | गणपत्यथर्वशीर्षम् | Deity | ganapatya | 14 | ganesh-chaturthi, vinayaka-chaturthi, sankashti-chaturthi | fetched |
| Saṅkaṭa-nāśana Gaṇeśa Stotram | सङ्कटनाशनगणेशस्तोत्रम् | Deity | ganapatya | 8 | sankashti-chaturthi, ganesh-chaturthi | fetched |
| Gaṇeśa Pañcaratnam | गणेशपञ्चरत्नम् | Deity | ganapatya | 6 | ganesh-chaturthi, vinayaka-chaturthi | fetched |
| Devī Aparādha-kṣamāpana Stotram | देव्यपराधक्षमापनस्तोत्रम् | Deity | shakta | 12 | navaratri-begins, durga-ashtami | fetched |
| Bhavānyaṣṭakam | भवान्यष्टकम् | Deity | shakta | 8 | navaratri-begins, durga-ashtami | fetched |
| Mahālakṣmyaṣṭakam | महालक्ष्म्यष्टकम् | Deity | shakta | 11 | diwali, sharad-purnima | fetched |
| Kṣamā-prārthanā | क्षमाप्रार्थना | Other | shakta | 8 | navaratri-begins | fetched |
| Śrī Dattātreya Stotram | श्रीदत्तात्रेयस्तोत्रम् | Deity | dattatreya | 19 | datta-jayanti, purnima | fetched |
| Śrī Datta-stava Stotram | श्रीदत्तस्तवस्तोत्रम् | Deity | dattatreya | 9 | datta-jayanti | fetched |
| Śrī Rāma-rakṣā Stotram | श्रीरामरक्षास्तोत्रम् | Deity | vaishnava | 39 | rama-navami | fetched |
| Pāṇḍuraṅgāṣṭakam | पाण्डुरङ्गाष्टकम् | Deity | vaishnava | 9 | ekadashi | fetched |
| Āditya-hṛdayam | आदित्यहृदयम् | Morning | smarta | 31 | sankranti-makara | fetched |
| Kara-darśanam (on waking) | करदर्शनम् | Morning | smarta | 1 |  | fetched |
| Bhūmi-vandanam (before stepping on the earth) | भूमिवन्दनम् | Morning | smarta | 1 |  | fetched |
| Prātaḥ-smaraṇam (morning verses) | प्रातःस्मरणम् | Morning | smarta | 11 |  | fetched |
| Gāyatrī Mantra | गायत्रीमन्त्रः | Morning | smarta | 1 |  | fetched |
| Saha nāv avatu | ॐ सह नाववतु | Peace | smarta | 1 |  | fetched |
| Hanumān Cālīsā | हनुमान चालीसा | Deity | vaishnava |  | hanuman-jayanti | wanted, no source yet |
| Om Jai Jagdīś Hare | ॐ जय जगदीश हरे | Aarti | vaishnava |  | diwali | wanted, no source yet |
| Sukhakartā Dukhahartā (Gaṇapati ārati) | सुखकर्ता दुःखहर्ता | Aarti | ganapatya |  | ganesh-chaturthi | wanted, no source yet |
| Durge Durghaṭ Bhārī (Devī ārati) | दुर्गे दुर्घट भारी | Aarti | shakta |  | navaratri-begins | wanted, no source yet |
| Trigunātmaka Traimūrtī (Datta ārati) | त्रिगुणात्मक त्रैमूर्ती | Aarti | dattatreya |  | datta-jayanti | wanted, no source yet |
| Om Jai Śiv Oṅkārā (Śiva ārati) | ॐ जय शिव ओंकारा | Aarti | shaiva |  | maha-shivaratri | wanted, no source yet |
| Kālabhairavāṣṭakam | कालभैरवाष्टकम् | Deity | shaiva |  |  | wanted, no source yet |
| Ghora-kaṣṭoddhāraṇa Stotram | घोरकष्टोद्धारणस्तोत्रम् | Deity | dattatreya |  | datta-jayanti | wanted, no source yet |
| Datta Bāvanī | દત્ત બાવની | Deity | dattatreya |  | datta-jayanti | excluded |

## Notes

- **Śrī Nāmāṣṭakam**: kksongs.org has it in Roman letters only, and no Devanagari copy open for reuse was found (not on Sanskrit Wikisource). Wanted: a Devanagari source.
- **Śrī Hari-vāsare**: kksongs.org has it in Roman letters only, and no Bengali copy open for reuse was found (not on Bengali Wikisource). Wanted: a Bengali source.
- **Bhaja Govindam**: The page numbers the closing verse of the first twelve “12a”; it is kept as its own verse, so the page’s 13–33 are 14–34 here.
- **Śiva Tāṇḍava Stotram**: Verses 14 and 15 (nilimpa-nātha-nāgarī…, pracaṇḍa-vāḍavānala…) are in this edition and not in the shorter one most often sung; the owner may drop them with `select`.
- **Śiva Mānasa Pūjā**: The page’s fifth verse (the fruit) is garbled, so the prayer is its four verses.
- **Hanumān Cālīsā**: Tulasīdāsa’s Avadhī text is public domain, but Hindi Wikisource has no page for it and the sites that carry it forbid copying. Needs a printed copy (Gita Press) typed in by hand.
- **Om Jai Jagdīś Hare**: Śraddhārām Phillaurī’s Hindi ārati (1870s) is public domain; no free typed copy was found (not on Hindi Wikisource).
- **Sukhakartā Dukhahartā (Gaṇapati ārati)**: Samartha Rāmadāsa’s Marathi ārati is public domain; Marathi Wikisource has no clean copy (only a scanned book of another tradition’s āratis).
- **Durge Durghaṭ Bhārī (Devī ārati)**: Samartha Rāmadāsa’s Marathi ārati; Marathi Wikisource names it but has no text.
- **Trigunātmaka Traimūrtī (Datta ārati)**: Ekanātha’s Marathi ārati is public domain; no free typed copy was found.
- **Om Jai Śiv Oṅkārā (Śiva ārati)**: The popular Hindi ārati; its author and date are not settled, and no free typed copy was found. Sanskrit Wikisource’s “शिव आरती” is a different, Sanskrit ārati.
- **Kālabhairavāṣṭakam**: Sanskrit Wikisource’s page has no verse numbers and about fifteen typos; it needs a cleaner copy before it can be taken.
- **Ghora-kaṣṭoddhāraṇa Stotram**: Vāsudevānanda Sarasvatī’s stotra; Sanskrit Wikisource’s copy has no verse numbers and about fifteen typos.
- **Datta Bāvanī**: Written in Gujarati by Raṅga Avadhūta, who died in 1968: in copyright in India until 2029. Not to be published without his trust’s permission.
