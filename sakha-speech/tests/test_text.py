from sakha_speech.text import CLAUSE_PAUSE, SENTENCE_PAUSE, normalise, split


def test_diacritics_become_speakable_english():
    assert normalise("Śrī Kṛṣṇa said to Arjuna in Kurukṣetra.", "en") == "Shri Krishna said to Arjuna in Kurukshetra."


def test_hindi_keeps_its_script():
    assert normalise("श्री कृष्ण ने कहा॥", "hi") == "श्री कृष्ण ने कहा।"


def test_lexicon_matches_whole_words_in_any_case():
    out = normalise("The gita and the Gitavali.", "en", {"Gita": "Geeta"})
    assert out == "The Geeta and the Gitavali."


def test_verse_references_are_read_out_in_english():
    assert normalise("See 2.47 and 1.16-18.", "en") == "See chapter 2, verse 47 and chapter 1, verse 16 to 18."


def test_split_on_sentences_and_danda_with_pauses():
    assert split("One. Two? Three") == [("One.", SENTENCE_PAUSE), ("Two?", SENTENCE_PAUSE), ("Three", 0)]
    assert [p for p, _ in split("पहला। दूसरा।तीसरा")] == ["पहला।", "दूसरा।", "तीसरा"]


def test_a_long_sentence_is_broken_at_commas_then_spaces():
    sentence = ", ".join(["word " * 8] * 6).strip() + "."
    pieces = split(sentence, max_chars=100)
    assert all(len(p) <= 100 for p, _ in pieces)
    assert [pause for _, pause in pieces][:-1] == [CLAUSE_PAUSE] * (len(pieces) - 1)
    assert " ".join(p for p, _ in pieces).replace("  ", " ") == sentence
    long_word_run = "a" * 250
    assert all(len(p) <= 100 for p, _ in split(long_word_run, 100))
