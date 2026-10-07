import { ScrollTopButton } from '@/components/scroll-top-button';
import { Faq } from '@/sections/faq';
import { Features } from '@/sections/features';
import { Footer } from '@/sections/footer';
import { Header } from '@/sections/header';
import { Hero } from '@/sections/hero';
import { LanguageBand } from '@/sections/language-band';
import { Practice } from '@/sections/practice';
import { Reels } from '@/sections/reels';
import { Start } from '@/sections/start';
import { Why } from '@/sections/why';

// The whole page, top to bottom.
export function App() {
  return (
    <>
      <a className="skip-link" href="#top">
        Skip to content
      </a>
      <Header />
      <main id="top">
        <Hero />
        <LanguageBand />
        <Why />
        <Features />
        <Practice />
        <Reels />
        <Faq />
        <Start />
      </main>
      <Footer />
      <ScrollTopButton />
    </>
  );
}
