-- The English words auto count listens for, per mantra (see Mantra.chantWords in the schema).
ALTER TABLE "Mantra" ADD COLUMN "chantWords" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Starting words for the seeded mantras: the words of their phrase spellings. Only a mantra
-- with none is touched, so an admin's list stays. (`prisma migrate deploy` runs on every release; the seed does not.)
UPDATE "Mantra" SET "chantWords" = ARRAY['hare','krishna','rama','hari','ram'] WHERE "slug" = 'hare-krishna-mahamantra' AND cardinality("chantWords") = 0;
UPDATE "Mantra" SET "chantWords" = ARRAY['sri','krishna','chaitanya','prabhu','nityananda','advaita','gadadhara','srivasadi','gaura','bhakta','vrinda','shri','gadadhar','shrivasadi'] WHERE "slug" = 'panchatattva-mantra' AND cardinality("chantWords") = 0;
UPDATE "Mantra" SET "chantWords" = ARRAY['om','namo','bhagavate','vasudevaya','bhagwate','vasudevay','vaasudevaaya'] WHERE "slug" = 'om-namo-bhagavate-vasudevaya' AND cardinality("chantWords") = 0;
UPDATE "Mantra" SET "chantWords" = ARRAY['sri','rama','jaya','shri','ram','jai'] WHERE "slug" = 'rama-taraka-mantra' AND cardinality("chantWords") = 0;
UPDATE "Mantra" SET "chantWords" = ARRAY['ugram','viram','maha','vishnum','jvalantam','sarvato','mukham','nrisimham','bhishanam','bhadram','mrityu','mrityum','namamyaham','veeram','jwalantam','narasimham','bheeshanam'] WHERE "slug" = 'nrisimha-mantra' AND cardinality("chantWords") = 0;
UPDATE "Mantra" SET "chantWords" = ARRAY['om','devakinandanaya','vidmahe','vasudevaya','dhimahi','tanno','krishnah','prachodayat','devaki','nandanaya','dheemahi','krishna'] WHERE "slug" = 'krishna-gayatri' AND cardinality("chantWords") = 0;
UPDATE "Mantra" SET "chantWords" = ARRAY['om','narayanaya','vidmahe','vasudevaya','dhimahi','tanno','vishnuh','prachodayat','dheemahi','vishnu'] WHERE "slug" = 'vishnu-gayatri' AND cardinality("chantWords") = 0;
UPDATE "Mantra" SET "chantWords" = ARRAY['om','aum'] WHERE "slug" = 'pranava-om' AND cardinality("chantWords") = 0;
UPDATE "Mantra" SET "chantWords" = ARRAY['om','namah','shivaya','namaha','nama','shivay'] WHERE "slug" = 'om-namah-shivaya' AND cardinality("chantWords") = 0;
UPDATE "Mantra" SET "chantWords" = ARRAY['om','tryambakam','yajamahe','sugandhim','pushtivardhanam','urvarukamiva','bandhanan','mrityor','mukshiya','mamritat','trayambakam','pushti','vardhanam','bandhanat','maamritat'] WHERE "slug" = 'maha-mrityunjaya-mantra' AND cardinality("chantWords") = 0;
UPDATE "Mantra" SET "chantWords" = ARRAY['om','tatpurushaya','vidmahe','mahadevaya','dhimahi','tanno','rudrah','prachodayat','dheemahi','rudra'] WHERE "slug" = 'shiva-gayatri' AND cardinality("chantWords") = 0;

