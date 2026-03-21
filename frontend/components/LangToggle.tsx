'use client';

import { useLocale } from '@/lib/i18n';

export default function LangToggle({ style }: { style?: React.CSSProperties }) {
  const { lang, setLang } = useLocale();

  return (
    <select
      value={lang}
      onChange={(e) => setLang(e.target.value as 'tr' | 'en')}
      title='Language'
      style={{
        padding: '5px 10px', borderRadius: 8, cursor: 'pointer',
        border: '1px solid rgba(255,255,255,0.1)',
        background: 'rgba(255,255,255,0.04)',
        color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: 700,
        letterSpacing: 0.2, transition: 'all 0.2s',
        appearance: 'none',
        ...style,
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLSelectElement).style.borderColor = 'rgba(13,148,136,0.4)'; (e.currentTarget as HTMLSelectElement).style.color = '#5eead4'; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLSelectElement).style.borderColor = 'rgba(255,255,255,0.1)'; (e.currentTarget as HTMLSelectElement).style.color = 'rgba(255,255,255,0.75)'; }}
    >
      <option value='tr' style={{ background: '#0d1117' }}>🇹🇷 TR</option>
      <option value='en' style={{ background: '#0d1117' }}>🇬🇧 EN</option>
    </select>
  );
}
