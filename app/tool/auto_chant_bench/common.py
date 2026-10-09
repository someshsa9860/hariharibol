import os, re
# Models and generated audio go here, outside git (see .gitignore). Override with BENCH_WORK.
W = os.path.abspath(os.environ.get("BENCH_WORK", os.path.join(os.path.dirname(__file__), "work")))
M = W + "/models"
CORP = W + "/corpus"
# slug -> (devanagari from backend/prisma/seed/data.js, roman phrases from chant-phrases.js)
MANTRAS = {
 "rama-taraka-mantra": ("श्री राम जय राम जय जय राम", ["Sri Rama Jaya Rama Jaya Jaya Rama","Shri Ram Jai Ram Jai Jai Ram"]),
 "om-namah-shivaya": ("ॐ नमः शिवाय", ["Om Namah Shivaya","Om Namaha Shivaya","Om Nama Shivay"]),
 "om-namo-bhagavate-vasudevaya": ("ॐ नमो भगवते वासुदेवाय", ["Om Namo Bhagavate Vasudevaya","Om Namo Bhagwate Vasudevay","Om Namo Bhagavate Vaasudevaaya"]),
 "hare-krishna-mahamantra": ("हरे कृष्ण हरे कृष्ण कृष्ण कृष्ण हरे हरे हरे राम हरे राम राम राम हरे हरे", ["Hare Krishna Hare Krishna Krishna Krishna Hare Hare Hare Rama Hare Rama Rama Rama Hare Hare","Hari Krishna Hari Krishna Krishna Krishna Hari Hari Hari Rama Hari Rama Rama Rama Hari Hari","Hare Krishna Hare Krishna Krishna Krishna Hare Hare Hare Ram Hare Ram Ram Ram Hare Hare"]),
 "pranava-om": ("ॐ", ["Om","Aum"]),
 "krishna-gayatri": ("ॐ देवकीनन्दनाय विद्महे वासुदेवाय धीमहि तन्नो कृष्णः प्रचोदयात्", ["Om Devakinandanaya Vidmahe Vasudevaya Dhimahi Tanno Krishnah Prachodayat","Om Devaki Nandanaya Vidmahe Vasudevaya Dheemahi Tanno Krishna Prachodayat"]),
 "maha-mrityunjaya-mantra": ("ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम् उर्वारुकमिव बन्धनान्मृत्योर्मुक्षीय माऽमृतात्", ["Om Tryambakam Yajamahe Sugandhim Pushtivardhanam Urvarukamiva Bandhanan Mrityor Mukshiya Mamritat"]),
 "nrisimha-mantra": ("उग्रं वीरं महाविष्णुं ज्वलन्तं सर्वतोमुखम् नृसिंहं भीषणं भद्रं मृत्युमृत्युं नमाम्यहम्", ["Ugram Viram Maha Vishnum Jvalantam Sarvato Mukham Nrisimham Bhishanam Bhadram Mrityu Mrityum Namamyaham"]),
}
RESULTS = W + "/results"
