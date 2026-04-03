'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

const GA_LANDING = process.env.NEXT_PUBLIC_GA_ID;
const GA_DASHBOARD = process.env.NEXT_PUBLIC_GA_DASHBOARD_ID;

// Primary ID used to load the gtag.js library
const PRIMARY_ID = GA_LANDING || GA_DASHBOARD;

export default function GoogleAnalytics() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window.gtag !== 'function' || !pathname) return;

    const isDashboard = pathname.startsWith('/dashboard');
    const targetId = isDashboard ? GA_DASHBOARD : GA_LANDING;

    if (targetId) {
      window.gtag('config', targetId, { page_path: pathname });
    }
  }, [pathname]);

  if (!PRIMARY_ID) return null;

  return (
    <>
      <Script src={`https://www.googletagmanager.com/gtag/js?id=${PRIMARY_ID}`} strategy='afterInteractive' />
      <Script id='google-analytics' strategy='afterInteractive'>
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          ${GA_LANDING ? `gtag('config', '${GA_LANDING}', { page_path: window.location.pathname });` : ''}
          ${GA_DASHBOARD ? `gtag('config', '${GA_DASHBOARD}', { send_page_view: false });` : ''}
        `}
      </Script>
    </>
  );
}
