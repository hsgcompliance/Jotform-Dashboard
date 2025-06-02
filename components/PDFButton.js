import FileSaver from 'file-saver';
import { IconButton, Tooltip } from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
export default function PDFButton({ url, name }) {
  if (!url) return null;
  return (
    <Tooltip title="Download PDF">
      <IconButton size="small" onClick={() => FileSaver.saveAs(url, `${name}.pdf`)}>
        <PictureAsPdfIcon fontSize="inherit" />
      </IconButton>
    </Tooltip>
  );
}
