import { IconButton, Tooltip, CircularProgress } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';

/**
 * @param {function} onClick
 * @param {boolean}  loading – if true shows spinner
 * @param {string}   title   – tooltip
 */
export default function ManualRefresh({ onClick, loading=false, title='Refresh' }) {
  return (
    <Tooltip title={title}>
      <IconButton size="small" onClick={onClick} disabled={loading}>
        {loading
          ? <CircularProgress size={18} />
          : <RefreshIcon fontSize="inherit" />
        }
      </IconButton>
    </Tooltip>
  );
}
