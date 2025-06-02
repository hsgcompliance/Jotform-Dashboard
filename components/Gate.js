import { useSession, signIn } from 'next-auth/react';
import { useEffect } from 'react';

export default function Gate({ children }) {
  const { data: session, status } = useSession();

  /* silent login once */
  useEffect(() => {
    if (status === 'unauthenticated') {
      signIn('google', { prompt: 'none' });   // invisible if Google cookie exists
    }
  }, [status]);

  if (status === 'loading') return null;

  if (!session) {
    return (
      <div style={{ padding: 40 }}>
        <button onClick={() => signIn('google')}>Sign in with HRDC Google</button>
      </div>
    );
  }

  return children;    // user is in
}
