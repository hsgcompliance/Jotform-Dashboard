import { SessionProvider } from 'next-auth/react';
import { createTheme, ThemeProvider, CssBaseline } from '@mui/material';
import { useMemo, useState } from 'react';
import Gate from '../components/Gate';
import Nav from '../components/Nav';
import ErrorBoundary from '../components/ErrorBoundary';

export default function MyApp({ Component, pageProps: { session, ...rest } }) {
  const [mode, setMode] = useState('light');
  const theme = useMemo(() => createTheme({ palette: { mode } }), [mode]);

  return (
    <SessionProvider session={session}>
      <ThemeProvider theme={theme}>
        <CssBaseline />

        {/* dark / light toggle */}
        <button
          onClick={() => setMode(p => (p === 'light' ? 'dark' : 'light'))}
          style={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1300 }}
        >
          {mode === 'light' ? '🌙' : '☀️'}
        </button>

        {/* auth gate + NAV + page */}
        <Gate>
          <ErrorBoundary>
            <Nav />
            <Component {...rest} />
          </ErrorBoundary>
        </Gate>
      </ThemeProvider>
    </SessionProvider>
  );
}
