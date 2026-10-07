// Each language is written in its own script, tagged so browsers pick the right font.
const LANGUAGES = [
  { code: 'sa', name: 'संस्कृतम्' },
  { code: 'en', name: 'English' },
  { code: 'hi', name: 'हिन्दी' },
  { code: 'mr', name: 'मराठी' },
  { code: 'kn', name: 'ಕನ್ನಡ' },
  { code: 'ta', name: 'தமிழ்' },
  { code: 'te', name: 'తెలుగు' },
  { code: 'ml', name: 'മലയാളം' },
  { code: 'bn', name: 'বাংলা' },
  { code: 'gu', name: 'ગુજરાતી' },
  { code: 'or', name: 'ଓଡ଼ିଆ' },
  { code: 'pa', name: 'ਪੰਜਾਬੀ' },
  { code: 'as', name: 'অসমীয়া' },
];

export function LanguageBand() {
  return (
    <section className="lang-band" aria-labelledby="lang-title">
      <p id="lang-title" className="lang-title">
        Mantra meanings in 13 languages
      </p>
      <ul className="lang-list">
        {LANGUAGES.map((language) => (
          <li key={language.code} lang={language.code}>
            {language.name}
          </li>
        ))}
      </ul>
    </section>
  );
}
