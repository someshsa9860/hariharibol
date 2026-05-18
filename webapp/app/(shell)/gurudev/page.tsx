import dynamic from 'next/dynamic';

const GuruDevChat = dynamic(() => import('./GuruDevChat'), {
  ssr: false,
  loading: () => (
    <div style={{
      height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'linear-gradient(135deg, #006B6B, #2D5A27)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '2rem', fontFamily: '"Noto Sans Devanagari", serif', color: '#fff',
        animation: 'pulse 1.5s ease-in-out infinite',
      }}>ॐ</div>
    </div>
  ),
});

export default function GuruDevPage() {
  return <GuruDevChat />;
}
