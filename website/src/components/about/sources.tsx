import { CONTACT_EMAIL, TEXT_SOURCES } from '@/lib/config';

/**
 * The body of `/sources`: whose words the texts are, where they were taken from, that the other languages are
 * AI-assisted, what Sakha is and is not, that the project speaks for no one else, and whom to write to. The same
 * wording as the app's Settings → Sources & disclaimer. Prabhupāda's credit line always shows here — this page is
 * the record of where the texts come from, not the per-verse byline that `SHOW_AUTHOR_NAME` still keeps off.
 */
export function Sources() {
  return (
    <div className="sources">
      <section>
        <h2>Translations and commentaries</h2>
        <p>
          The English translations and purports of Bhagavad-gītā As It Is and Śrīmad-Bhāgavatam are the work of His
          Divine Grace A. C. Bhaktivedanta Swami Prabhupāda, Founder-Ācārya of the International Society for Krishna
          Consciousness. © The Bhaktivedanta Book Trust International, Inc.
        </p>
        <p>
          Every translation, purport and commentary is the work of its author, and all rights in it remain with its
          authors and publishers. They are reproduced here for personal devotional study, not for redistribution.
        </p>
      </section>

      <section>
        <h2>Where the texts come from</h2>
        <ul className="source-list">
          {TEXT_SOURCES.map((source) => (
            <li key={source.address}>
              <span>{source.label}</span>
              <span className="source-address">{source.address}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>Translations into other languages</h2>
        <p>
          Text in Hindi, Marathi and the other Indian languages — translations and purports — has been prepared from
          the English with the help of AI. It is not an official or authorised translation and may contain errors,
          which we correct as they are found. For study, the Sanskrit and the original English remain the authority.
        </p>
      </section>

      <section>
        <h2>Ask Sakha</h2>
        <p>
          Sakha is a digital companion, not a teacher. Its replies are not the words of any ācārya and can be mistaken;
          please check anything important against the texts.
        </p>
      </section>

      <section>
        <h2>An independent project</h2>
        <p>
          HariHariBol is an independent devotional project. It is not affiliated with, endorsed by or speaking for any
          temple, organisation or publisher.
        </p>
      </section>

      <section>
        <h2>Rights and corrections</h2>
        <p>
          If you hold rights in any text shown here, or find a mistake in one, please write to us. We will reply
          promptly and, where asked, correct or remove it.
        </p>
        <p><a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a></p>
      </section>
    </div>
  );
}
