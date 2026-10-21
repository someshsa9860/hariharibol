/// How the reading screen lays a chapter out.
///
/// [verses] is the study layout: every verse a block of its own, with all the
/// parts of the verse and the actions under it. [story] reads the chapter as
/// one continuous text, showing a single part of the verse (see [StoryPart]).
enum ReadingMode { verses, story }

/// The one part of a verse that story mode shows. Unlike `VersePart` (what the
/// reader hides in verse by verse mode) it includes the translation, because the
/// story is read *from* a part rather than with parts taken away.
enum StoryPart { sanskrit, transliteration, translation, purport }
