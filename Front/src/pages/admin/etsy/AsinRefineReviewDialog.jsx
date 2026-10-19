import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  Link,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import CloseIcon from '@mui/icons-material/Close';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DoNotDisturbIcon from '@mui/icons-material/DoNotDisturb';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SaveIcon from '@mui/icons-material/Save';
import UndoIcon from '@mui/icons-material/Undo';
import VerticalSplitIcon from '@mui/icons-material/VerticalSplit';
import api from '../../../lib/api';

const TITLE_LIMIT = 130;
const TAG_COUNT = 13;
const TAG_MAX_LENGTH = 20;
export const REVIEW_EDITABLE_FIELDS = [
  'sku', 'brand', 'price', 'refinedTitle', 'refinedDescription', 'material', 'color', 'tags', 'warning',
];

export function reviewRowKey(row) {
  const store = row.store?._id || row.store || '';
  return `${store}:${row.region || 'US'}:${row.asin}`;
}

export function isStubRow(row) {
  return String(row?._id || '').startsWith('loading-');
}

export function isDraftDirty(row, draft) {
  return Boolean(draft && REVIEW_EDITABLE_FIELDS.some((f) => (row[f] || '') !== (draft[f] ?? '')));
}

function splitTags(text) {
  return String(text || '').split(',').map((tag) => tag.trim()).filter(Boolean);
}

function rowState(row, dismissed) {
  if (dismissed) return { label: 'Dismissed', color: 'default' };
  if (row.status === 'loading') return { label: 'Scraping…', color: 'info', loading: true };
  if (row._pending) return { label: 'Refining…', color: 'secondary', loading: true };
  if (row.status === 'error') return { label: 'Error', color: 'error' };
  if (row.status === 'refined') return { label: 'Refined', color: 'success' };
  return { label: 'Scraped – not refined', color: 'warning' };
}

function SectionLabel({ children, action }) {
  return (
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 0.5 }}>
      <Typography variant="overline" color="text.secondary" sx={{ lineHeight: 1.6 }}>{children}</Typography>
      {action}
    </Stack>
  );
}

function CopyIcon({ text, label, onCopy }) {
  return (
    <Tooltip title={`Copy ${label}`}>
      <span>
        <IconButton size="small" disabled={!text} onClick={() => onCopy(text, label)}>
          <ContentCopyIcon sx={{ fontSize: 16 }} />
        </IconButton>
      </span>
    </Tooltip>
  );
}

function CharCount({ text, limit }) {
  const count = String(text || '').length;
  return (
    <Typography variant="caption" color={limit && count > limit ? 'error' : 'text.secondary'}>
      {count}{limit ? ` / ${limit}` : ''} characters
    </Typography>
  );
}

function TagSummary({ text }) {
  const tags = splitTags(text);
  const tooLong = tags.filter((tag) => tag.length > TAG_MAX_LENGTH);
  return (
    <Box sx={{ mt: 0.75 }}>
      <Typography variant="caption" color={tags.length === TAG_COUNT ? 'success.main' : 'error'}>
        {tags.length} / {TAG_COUNT} tags
      </Typography>
      {tooLong.length > 0 && (
        <Typography variant="caption" color="error" sx={{ ml: 1 }}>
          Over {TAG_MAX_LENGTH} characters: {tooLong.join(', ')}
        </Typography>
      )}
      {tags.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
          {tags.map((tag, i) => (
            <Chip
              key={`${tag}-${i}`}
              size="small"
              label={`${tag} (${tag.length})`}
              color={tag.length > TAG_MAX_LENGTH ? 'error' : 'default'}
              variant="outlined"
            />
          ))}
        </Box>
      )}
    </Box>
  );
}

function openSplitView(url) {
  const width = Math.floor(window.screen.availWidth / 2);
  const height = window.screen.availHeight;
  window.open(url, 'asinRefineAmazon', `width=${width},height=${height},left=${width},top=0`);
}

export default function AsinRefineReviewDialog({
  open,
  rows,
  index,
  onIndexChange,
  drafts,
  onDraftChange,
  dismissed,
  onToggleDismiss,
  onRowUpdated,
  onSaveAll,
  savingAll,
  progress,
  onClose,
  onCopy,
  notify,
  prompt,
  amazonUrl,
  formatPrice,
}) {
  const [activeImage, setActiveImage] = useState(0);
  const [refining, setRefining] = useState(false);
  const [splitView, setSplitView] = useState(false);

  const row = rows[index] || null;
  const key = row ? reviewRowKey(row) : '';
  const draft = row ? (drafts[key] || Object.fromEntries(REVIEW_EDITABLE_FIELDS.map((f) => [f, row[f] || '']))) : null;
  const isDismissed = row ? dismissed.has(key) : false;
  const rowBusy = row ? row.status === 'loading' || Boolean(row._pending) : false;
  const hasPrev = index > 0;
  const hasNext = index < rows.length - 1;

  const summary = useMemo(() => {
    let loading = 0;
    let errors = 0;
    let edited = 0;
    for (const r of rows) {
      if (r.status === 'loading' || r._pending) loading += 1;
      else if (r.status === 'error') errors += 1;
      if (isDraftDirty(r, drafts[reviewRowKey(r)])) edited += 1;
    }
    const removed = rows.filter((r) => dismissed.has(reviewRowKey(r)) && !isStubRow(r)).length;
    return { loading, errors, edited, removed };
  }, [rows, drafts, dismissed]);

  useEffect(() => {
    setActiveImage(0);
  }, [key]);

  useEffect(() => {
    if (splitView && row && !isStubRow(row)) openSplitView(amazonUrl(row));
  }, [splitView, key]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target?.isContentEditable) return;
      if (e.key === 'ArrowLeft' && index > 0) onIndexChange(index - 1);
      if (e.key === 'ArrowRight' && index < rows.length - 1) onIndexChange(index + 1);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, index, rows.length, onIndexChange]);

  if (!open || !row) return null;

  const fieldsDisabled = rowBusy || isDismissed || refining || savingAll || isStubRow(row);
  const setField = (field) => (e) => onDraftChange(key, { ...draft, [field]: e.target.value });
  const images = row.images || [];
  const state = rowState(row, isDismissed);
  const hasPrompt = Boolean(prompt.trim());

  const refineRow = async () => {
    setRefining(true);
    try {
      const { data } = await api.post('/etsy/asin-refine/refine', { ids: [row._id], prompt });
      const updated = data.items?.[0];
      if (updated) {
        onRowUpdated(updated);
        if (drafts[key]) {
          onDraftChange(key, {
            ...draft,
            refinedTitle: updated.refinedTitle || '',
            refinedDescription: updated.refinedDescription || '',
            material: updated.material || '',
            color: updated.color || '',
            tags: updated.tags || '',
            warning: updated.warning || '',
          });
        }
        notify(updated.error || 'Revised with OpenAI', updated.error ? 'error' : 'success');
      }
    } catch (err) {
      notify(err.response?.data?.error || 'Refine failed', 'error');
    } finally {
      setRefining(false);
    }
  };

  const saveLabel = summary.edited || summary.removed
    ? `Save All (${[
      summary.edited ? `${summary.edited} edited` : '',
      summary.removed ? `${summary.removed} dismissed` : '',
    ].filter(Boolean).join(', ')})`
    : 'Done';

  return (
    <Dialog open fullScreen={!splitView} onClose={savingAll ? undefined : onClose}
      PaperProps={splitView ? { sx: { position: 'fixed', left: 0, top: 0, m: 0, width: '50vw', maxWidth: '50vw', height: '100vh', maxHeight: '100vh', borderRadius: 0 } } : undefined}
    >
      <DialogTitle sx={{ pb: 1 }}>
        <Stack direction="row" alignItems="center" spacing={1} flexWrap="wrap" useFlexGap>
          <Typography variant="h6" component="span">Review Refined Listings</Typography>
          <Chip size="small" label={`${index + 1} / ${rows.length}`} />
          <Chip
            size="small"
            color={state.color}
            label={state.label}
            icon={state.loading ? <CircularProgress size={12} color="inherit" /> : undefined}
          />
          {isDraftDirty(row, drafts[key]) && <Chip size="small" color="info" variant="outlined" label="Edited" />}
          <Box sx={{ flex: 1 }} />
          <Typography variant="caption" color="text.secondary">
            {[
              summary.loading ? `${summary.loading} in progress` : '',
              summary.errors ? `${summary.errors} errors` : '',
              summary.edited ? `${summary.edited} edited` : '',
              dismissed.size ? `${dismissed.size} dismissed` : '',
            ].filter(Boolean).join(' · ')}
          </Typography>
          <Tooltip title={splitView ? 'Back to full screen' : 'Split view: review on the left, Amazon page on the right'}>
            <IconButton size="small" onClick={() => setSplitView((v) => !v)} color={splitView ? 'primary' : 'default'}>
              <VerticalSplitIcon />
            </IconButton>
          </Tooltip>
          <IconButton size="small" onClick={onClose} disabled={savingAll}><CloseIcon /></IconButton>
        </Stack>
        {progress && (
          <Box sx={{ mt: 1 }}>
            <Typography variant="caption" color="text.secondary">{progress.label} {progress.done} / {progress.total}</Typography>
            <LinearProgress variant="determinate" value={progress.total ? (progress.done / progress.total) * 100 : 0} />
          </Box>
        )}
      </DialogTitle>

      <DialogContent dividers sx={{ p: 0, display: 'flex', flexDirection: { xs: 'column', md: splitView ? 'column' : 'row' }, opacity: isDismissed ? 0.55 : 1 }}>
        <Box sx={{ flexBasis: splitView ? 'auto' : '40%', flexShrink: 0, overflowY: 'auto', p: 2, borderRight: { md: splitView ? 0 : '1px solid' }, borderColor: 'divider', bgcolor: 'action.hover' }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Amazon source</Typography>
            <Link href={amazonUrl(row)} target="_blank" rel="noopener noreferrer"
              sx={{ fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
              {row.asin} <OpenInNewIcon sx={{ fontSize: 14 }} />
            </Link>
            <Chip size="small" label={row.region} />
            {row.storeName && <Chip size="small" variant="outlined" label={row.storeName} />}
          </Stack>

          {row.status === 'loading' ? (
            <Stack alignItems="center" spacing={1} sx={{ py: 8 }}>
              <CircularProgress />
              <Typography variant="body2" color="text.secondary">Scraping {row.asin} from Amazon…</Typography>
            </Stack>
          ) : (
            <>
              <Stack direction="row" spacing={3} sx={{ mb: 1.5 }}>
                <Box>
                  <Typography variant="caption" color="text.secondary">Brand</Typography>
                  <Typography variant="body2" fontWeight={600}>{row.brand || '—'}</Typography>
                </Box>
                <Box>
                  <Typography variant="caption" color="text.secondary">Price</Typography>
                  <Typography variant="body2" fontWeight={600}>{formatPrice(row.price, row.region)}</Typography>
                </Box>
              </Stack>

              <SectionLabel action={images.length > 0 && <CopyIcon text={images.join('\n')} label="all image URLs" onCopy={onCopy} />}>
                Images ({images.length})
              </SectionLabel>
              {images.length > 0 ? (
                <>
                  <Box component="a" href={images[activeImage]} target="_blank" rel="noopener noreferrer"
                    sx={{ display: 'block', bgcolor: '#fff', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                    <Box component="img" src={images[activeImage]} alt="" sx={{ width: '100%', height: 260, objectFit: 'contain', display: 'block' }} />
                  </Box>
                  <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap', mt: 1, mb: 2 }}>
                    {images.map((url, i) => (
                      <Box key={url} component="img" src={url} alt="" loading="lazy" onClick={() => setActiveImage(i)}
                        sx={{ width: 48, height: 48, objectFit: 'contain', bgcolor: '#fff', borderRadius: 0.75, cursor: 'pointer', border: '2px solid', borderColor: i === activeImage ? 'primary.main' : 'divider' }} />
                    ))}
                  </Box>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>No images scraped.</Typography>
              )}

              <SectionLabel action={<CopyIcon text={row.title} label="scraped title" onCopy={onCopy} />}>Title</SectionLabel>
              <Typography variant="body1" sx={{ wordBreak: 'break-word' }}>{row.title || '—'}</Typography>
              <CharCount text={row.title} limit={TITLE_LIMIT} />

              <Box sx={{ mt: 2 }}>
                <SectionLabel action={<CopyIcon text={row.description} label="scraped description" onCopy={onCopy} />}>Description</SectionLabel>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{row.description || '—'}</Typography>
              </Box>
            </>
          )}
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', p: 2 }}>
          {row.error && <Alert severity="error" sx={{ mb: 1.5 }}>{row.error}</Alert>}
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <Typography variant="subtitle1" fontWeight={700}>Refined listing</Typography>
            <Box sx={{ flex: 1 }} />
            <Tooltip title={hasPrompt ? 'Run OpenAI for this row with the current prompt' : 'Enter a prompt on the page first'}>
              <span>
                <Button size="small" variant="outlined" color="secondary"
                  startIcon={refining ? <CircularProgress size={14} color="inherit" /> : <AutoAwesomeIcon />}
                  onClick={refineRow}
                  disabled={!hasPrompt || fieldsDisabled}>
                  {row.refinedTitle || row.refinedDescription ? 'Re-run OpenAI' : 'Run OpenAI'}
                </Button>
              </span>
            </Tooltip>
            <Button
              size="small"
              variant={isDismissed ? 'contained' : 'outlined'}
              color={isDismissed ? 'inherit' : 'error'}
              startIcon={isDismissed ? <UndoIcon /> : <DoNotDisturbIcon />}
              onClick={() => onToggleDismiss(key)}
              disabled={savingAll}
            >
              {isDismissed ? 'Undo dismiss' : 'Dismiss'}
            </Button>
          </Stack>

          {isDismissed && (
            <Alert severity="warning" sx={{ mb: 1.5 }}>
              Dismissed — this row will be deleted when you click Save All.
            </Alert>
          )}

          {row._pending ? (
            <Stack alignItems="center" spacing={1} sx={{ py: 8 }}>
              <CircularProgress color="secondary" />
              <Typography variant="body2" color="text.secondary">Writing the listing with OpenAI…</Typography>
            </Stack>
          ) : (
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField label="SKU" value={draft.sku} onChange={setField('sku')} size="small" fullWidth disabled={fieldsDisabled}
                  InputProps={{ sx: { fontFamily: 'monospace', fontWeight: 700 } }} />
                <TextField label="Brand" value={draft.brand} onChange={setField('brand')} size="small" fullWidth disabled={fieldsDisabled} />
                <TextField label="Price" value={draft.price} onChange={setField('price')} size="small" fullWidth disabled={fieldsDisabled}
                  helperText={formatPrice(draft.price, row.region)} />
              </Stack>

              <Box>
                <Stack direction="row" alignItems="flex-start" spacing={0.5}>
                  <TextField label="Title" value={draft.refinedTitle} onChange={setField('refinedTitle')}
                    placeholder="Not refined yet" multiline minRows={2} fullWidth disabled={fieldsDisabled} />
                  <CopyIcon text={draft.refinedTitle} label="refined title" onCopy={onCopy} />
                </Stack>
                <CharCount text={draft.refinedTitle} limit={TITLE_LIMIT} />
              </Box>

              <Box>
                <Stack direction="row" alignItems="flex-start" spacing={0.5}>
                  <TextField label="Description" value={draft.refinedDescription} onChange={setField('refinedDescription')}
                    placeholder="Not refined yet" multiline minRows={12} fullWidth disabled={fieldsDisabled}
                    sx={{ '& textarea': { fontSize: '0.875rem' } }} />
                  <CopyIcon text={draft.refinedDescription} label="refined description" onCopy={onCopy} />
                </Stack>
                <CharCount text={draft.refinedDescription} />
              </Box>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flex: 1 }}>
                  <TextField label="Material" value={draft.material} onChange={setField('material')} size="small" fullWidth disabled={fieldsDisabled} />
                  <CopyIcon text={draft.material} label="material" onCopy={onCopy} />
                </Stack>
                <Stack direction="row" alignItems="center" spacing={0.5} sx={{ flex: 1 }}>
                  <TextField label="Color" value={draft.color} onChange={setField('color')} size="small" fullWidth disabled={fieldsDisabled} />
                  <CopyIcon text={draft.color} label="color" onCopy={onCopy} />
                </Stack>
              </Stack>

              <Box>
                <Stack direction="row" alignItems="flex-start" spacing={0.5}>
                  <TextField label="Tags (comma-separated)" value={draft.tags} onChange={setField('tags')}
                    size="small" multiline fullWidth disabled={fieldsDisabled} />
                  <CopyIcon text={draft.tags} label="tags" onCopy={onCopy} />
                </Stack>
                <TagSummary text={draft.tags} />
              </Box>

              <Stack direction="row" alignItems="flex-start" spacing={0.5}>
                <TextField label="Warning / safety info" value={draft.warning} onChange={setField('warning')}
                  placeholder="None" size="small" multiline fullWidth disabled={fieldsDisabled} />
                <CopyIcon text={draft.warning} label="warning" onCopy={onCopy} />
              </Stack>
            </Stack>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button startIcon={<ChevronLeftIcon />} onClick={() => onIndexChange(index - 1)} disabled={!hasPrev}>Previous</Button>
        <Button endIcon={<ChevronRightIcon />} onClick={() => onIndexChange(index + 1)} disabled={!hasNext}>Next</Button>
        <Typography variant="caption" color="text.secondary" sx={{ ml: 1, display: { xs: 'none', md: 'block' } }}>
          Tip: ← → keys move between rows
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Button onClick={onClose} disabled={savingAll}>Close</Button>
        <Button
          variant="contained"
          startIcon={savingAll ? <CircularProgress size={14} color="inherit" /> : <SaveIcon />}
          onClick={onSaveAll}
          disabled={savingAll || Boolean(progress)}
        >
          {saveLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
