//components/Nav.js
import Link from 'next/link';
import { AppBar, Toolbar, Button } from '@mui/material';

export default function Nav() {
  return (
    <AppBar position="static">
      <Toolbar sx={{ gap: 2 }}>
        <Link href="/budgets" passHref legacyBehavior>
          <Button color="inherit">Budgets</Button>
        </Link>
        <Link href="/line-items" passHref legacyBehavior>
          <Button color="inherit">Ledger</Button>
        </Link>
        <Link href="/live" passHref legacyBehavior>
          <Button color="inherit">Live Feed</Button>
        </Link>
        <Link href="/" passHref legacyBehavior>
          <Button color="inherit">Dashboard</Button>
        </Link>
        <Link href="/builder" passHref legacyBehavior>
          <Button color="inherit">Clone Template</Button>
        </Link>
      </Toolbar>
    </AppBar>
  );
}
