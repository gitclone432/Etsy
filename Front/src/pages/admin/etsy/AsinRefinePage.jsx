import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
  CircularProgress,
  Dialog,
  FormControlLabel,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  LinearProgress,
  MenuItem,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloudDownloadIcon from '@mui/icons-material/CloudDownload';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import EditNoteIcon from '@mui/icons-material/EditNote';
import RateReviewIcon from '@mui/icons-material/RateReview';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import RefreshIcon from '@mui/icons-material/Refresh';
import ShuffleIcon from '@mui/icons-material/Shuffle';
import api from '../../../lib/api';
import { dashboardSignatureTokens } from '../../../theme/appTheme';
import PageHeader from '../../../components/PageHeader.jsx';
import AdminPageShell from '../../../components/AdminPageShell.jsx';
import AsinRefineReviewDialog, {
  REVIEW_EDITABLE_FIELDS,
  isDraftDirty,
  isStubRow,
  reviewRowKey,
} from './AsinRefineReviewDialog.jsx';
import { DEFAULT_ASIN_REFINE_IMAGE_PROMPT, DEFAULT_ASIN_REFINE_PROMPT } from './asinRefineDefaultPrompt.js';

const ASIN_RE = /^[A-Z0-9]{10}$/;
const SCRAPE_BATCH_SIZE = 5;
const PROMPT_STORAGE_KEY = 'asinRefine.prompt';
const IMAGE_PROMPT_STORAGE_KEY = 'asinRefine.imagePrompt';
const AUTO_REFINE_STORAGE_KEY = 'asinRefine.autoRefine';
const STORE_STORAGE_KEY = 'asinRefine.storeId';
const ALL_STORES_VALUE = 'all';
const REGIONS = ['US', 'UK', 'CA', 'AU'];
const AMAZON_DOMAIN = { US: 'com', UK: 'co.uk', CA: 'ca', AU: 'com.au' };
const CURRENCY_SYMBOL = { US: '$', UK: '£', CA: 'C$', AU: 'A$' };

function formatPrice(price, region) {
  const text = String(price || '').trim();
  if (!text) return '—';
  return /^\d/.test(text) ? `${CURRENCY_SYMBOL[region] || '$'}${text}` : text;
}

const STATUS_CHIP = {
  pending: { label: 'Pending', color: 'default' },
  scraped: { label: 'Scraped', color: 'info' },
  refined: { label: 'Refined', color: 'success' },
  error: { label: 'Error', color: 'error' },
};

const headerCellSx = {
  backgroundColor: dashboardSignatureTokens.table.headerBackground,
  color: dashboardSignatureTokens.table.headerForeground,
  fontWeight: 700,
  whiteSpace: 'nowrap',
  borderBottom: 'none',
};

const clampSx = (lines) => ({
  display: '-webkit-box',
  WebkitLineClamp: lines,
  WebkitBoxOrient: 'vertical',
  overflow: 'hidden',
  whiteSpace: 'pre-line',
  wordBreak: 'break-word',
});

function parseAsins(text) {
  const seen = new Set();
  const valid = [];
  const invalid = [];
  for (const token of String(text || '').split(/[\s,;]+/)) {
    const asin = token.trim().toUpperCase();
    if (!asin) continue;
    if (!ASIN_RE.test(asin)) {
      if (!invalid.includes(asin)) invalid.push(asin);
      continue;
    }
    if (seen.has(asin)) continue;
    seen.add(asin);
    valid.push(asin);
  }
  return { valid, invalid };
}

function chunk(list, size) {
  const out = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

function loadStoredText(key, fallback) {
  const saved = localStorage.getItem(key);
  return saved && saved.trim() ? saved : fallback;
}

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function exportCsv(items) {
  const maxImages = items.reduce((max, item) => Math.max(max, item.images?.length || 0), 0);
  const headers = [
    'Store', 'ASIN', 'SKU', 'Brand', 'Price', 'Title', 'Refined Title', 'Description', 'Refined Description',
    'Material', 'Color', 'Tags', 'Warning',
    ...Array.from({ length: maxImages }, (_, i) => `Image ${i + 1}`),
  ];
  const rows = items.map((item) => [
    item.storeName, item.asin, item.sku, item.brand, item.price, item.title, item.refinedTitle,
    item.description, item.refinedDescription,
    item.material, item.color, item.tags, item.warning,
    ...Array.from({ length: maxImages }, (_, i) => item.images?.[i] || ''),
  ]);
  const csv = [headers, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `asin-refine-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function CopyButton({ text, label, onCopy }) {
  if (!text) return null;
  return (
    <Tooltip title={`Copy ${label}`}>
      <IconButton
        size="small"
        onClick={(e) => { e.stopPropagation(); onCopy(text, label); }}
        sx={{ p: 0.25 }}
      >
        <ContentCopyIcon sx={{ fontSize: 14 }} />
      </IconButton>
    </Tooltip>
  );
}

function AttributeValue({ label, value, onCopy }) {
  return (
    <Stack direction="row" alignItems="flex-start" spacing={0.25}>
      <Typography variant="body2" sx={{ wordBreak: 'break-word' }} color={value ? 'text.primary' : 'text.disabled'}>
        {value || '—'}
      </Typography>
      <CopyButton text={value} label={label} onCopy={onCopy} />
    </Stack>
  );
}

function TagCell({ tags, onCopy }) {
  const list = String(tags || '').split(',').map((tag) => tag.trim()).filter(Boolean);
  if (list.length === 0) {
    return <Typography variant="body2" color="text.disabled">—</Typography>;
  }
  const hasIssue = list.length !== 13 || list.some((tag) => tag.length > 20);
  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.25}>
        <Typography variant="caption" color={hasIssue ? 'error' : 'success.main'} fontWeight={600}>
          {list.length} / 13 tags
        </Typography>
        <CopyButton text={list.join(', ')} label="Tags" onCopy={onCopy} />
      </Stack>
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.25 }}>
        {list.map((tag, i) => (
          <Chip
            key={`${tag}-${i}`}
            label={tag}
            size="small"
            variant="outlined"
            color={tag.length > 20 ? 'error' : 'default'}
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
        ))}
      </Box>
    </Box>
  );
}

export default function AsinRefinePage() {
  const [asinText, setAsinText] = useState('');
  const [region, setRegion] = useState('US');
  const [prompt, setPrompt] = useState(() => loadStoredText(PROMPT_STORAGE_KEY, DEFAULT_ASIN_REFINE_PROMPT));
  const [imagePrompt, setImagePrompt] = useState(() => loadStoredText(IMAGE_PROMPT_STORAGE_KEY, DEFAULT_ASIN_REFINE_IMAGE_PROMPT));
  const [promptOpen, setPromptOpen] = useState(false);
  const [imagePromptOpen, setImagePromptOpen] = useState(false);
  const [autoRefine, setAutoRefine] = useState(() => localStorage.getItem(AUTO_REFINE_STORAGE_KEY) !== 'false');
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState(
    () => localStorage.getItem(STORE_STORAGE_KEY) || ALL_STORES_VALUE
  );

  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(() => new Set());

  const [progress, setProgress] = useState(null);
  const [review, setReview] = useState({ open: false, rows: [], index: 0 });
  const [drafts, setDrafts] = useState({});
  const [dismissed, setDismissed] = useState(() => new Set());
  const [savingAll, setSavingAll] = useState(false);
  const [galleryItem, setGalleryItem] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  const busy = Boolean(progress);
  const notify = (message, severity = 'success') => setSnackbar({ open: true, message, severity });

  const parsed = useMemo(() => parseAsins(asinText), [asinText]);

  useEffect(() => {
    localStorage.setItem(PROMPT_STORAGE_KEY, prompt);
  }, [prompt]);

  useEffect(() => {
    localStorage.setItem(IMAGE_PROMPT_STORAGE_KEY, imagePrompt);
  }, [imagePrompt]);

  useEffect(() => {
    localStorage.setItem(AUTO_REFINE_STORAGE_KEY, String(autoRefine));
  }, [autoRefine]);

  useEffect(() => {
    localStorage.setItem(STORE_STORAGE_KEY, selectedStoreId);
  }, [selectedStoreId]);

  const isAllStores = selectedStoreId === ALL_STORES_VALUE;
  const selectedStore = stores.find((store) => String(store._id) === String(selectedStoreId));
  const canScrapeStore = Boolean(selectedStore);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setStoresLoading(true);
      try {
        const { data } = await api.get('/etsy/stores');
        if (cancelled) return;
        const nextStores = Array.isArray(data.stores) ? data.stores : [];
        setStores(nextStores);
        setSelectedStoreId((current) => {
          if (current === ALL_STORES_VALUE) return current;
          if (nextStores.some((store) => String(store._id) === String(current))) return current;
          return nextStores[0]?._id || ALL_STORES_VALUE;
        });
      } catch (err) {
        if (!cancelled) notify(err.response?.data?.error || 'Failed to load Etsy stores', 'error');
      } finally {
        if (!cancelled) setStoresLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/etsy/asin-refine', {
        params: {
          page: page + 1,
          limit: rowsPerPage,
          search: search.trim() || undefined,
          storeId: selectedStoreId || ALL_STORES_VALUE,
        },
      });
      setItems(data.items || []);
      setTotal(data.total || 0);
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to load items', 'error');
    } finally {
      setLoading(false);
    }
  }, [page, rowsPerPage, search, selectedStoreId]);

  useEffect(() => {
    const timer = setTimeout(loadItems, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [loadItems, search]);

  const mergeItems = (updated) => {
    const byId = new Map(updated.map((item) => [item._id, item]));
    setItems((prev) => {
      const existing = new Set(prev.map((item) => item._id));
      const fresh = updated.filter((item) => !existing.has(item._id));
      return [...fresh, ...prev.map((item) => byId.get(item._id) || item)];
    });
  };

  const reviewHasChanges = () => dismissed.size > 0
    || review.rows.some((row) => isDraftDirty(row, drafts[reviewRowKey(row)]));

  const openReview = (rows, index = 0) => {
    if (review.rows.length > 0 && reviewHasChanges()
      && !window.confirm('Discard the unsaved edits and dismissals in your current review?')) {
      return false;
    }
    setDrafts({});
    setDismissed(new Set());
    setReview({ open: true, rows, index });
    return true;
  };

  const clearReview = () => {
    setReview({ open: false, rows: [], index: 0 });
    setDrafts({});
    setDismissed(new Set());
  };

  const updateReviewRows = (updated) => {
    const byKey = new Map(updated.map((row) => [reviewRowKey(row), row]));
    setReview((prev) => ({ ...prev, rows: prev.rows.map((row) => byKey.get(reviewRowKey(row)) || row) }));
  };

  const handleScrape = async () => {
    if (!canScrapeStore) {
      notify('Select an Etsy store first (add stores in Settings → Etsy Stores)', 'warning');
      return;
    }
    const asinsToScrape = parsed.valid;
    const stubs = asinsToScrape.map((asin) => ({
      _id: `loading-${selectedStoreId}-${region}-${asin}`,
      asin,
      region,
      store: selectedStoreId,
      storeName: selectedStore?.name || '',
      status: 'loading',
      images: [],
    }));
    if (!openReview(stubs)) return;

    const refineAfter = autoRefine && prompt.trim();
    const label = refineAfter ? 'Scraping & refining' : 'Scraping';
    const total = asinsToScrape.length;
    let done = 0;
    let scrapeFailed = 0;
    let refineFailed = 0;
    const bump = () => {
      done += 1;
      setProgress({ label, done: Math.min(done, total), total });
    };

    // Each scraped batch goes to OpenAI immediately while the next batch scrapes.
    const refineBatch = async (batch) => {
      try {
        const { data } = await api.post('/etsy/asin-refine/refine', { ids: batch.map((item) => item._id), prompt });
        mergeItems(data.items || []);
        updateReviewRows(data.items || []);
        refineFailed += (data.items || []).filter((item) => item.error).length;
      } catch (err) {
        const error = err.response?.data?.error || 'Refine failed';
        updateReviewRows(batch.map((item) => ({ ...item, _pending: false, error })));
        refineFailed += batch.length;
      }
      batch.forEach(bump);
    };

    setProgress({ label, done: 0, total });
    const refineJobs = [];
    for (const asins of chunk(asinsToScrape, SCRAPE_BATCH_SIZE)) {
      let scraped = [];
      try {
        const { data } = await api.post('/etsy/asin-refine/scrape', {
          asins,
          region,
          storeId: selectedStoreId,
        });
        scraped = data.items || [];
        mergeItems(scraped);
      } catch (err) {
        const error = err.response?.data?.error || 'Scrape failed';
        scraped = stubs.filter((s) => asins.includes(s.asin)).map((s) => ({ ...s, status: 'error', error }));
      }
      const ok = scraped.filter((item) => item.status !== 'error' && !isStubRow(item));
      const bad = scraped.filter((item) => !ok.includes(item));
      scrapeFailed += bad.length;
      bad.forEach(bump);

      if (refineAfter && ok.length > 0) {
        updateReviewRows([...bad, ...ok.map((item) => ({ ...item, _pending: true }))]);
        refineJobs.push(refineBatch(ok));
      } else {
        updateReviewRows(scraped);
        ok.forEach(bump);
      }
    }
    await Promise.all(refineJobs);

    setAsinText('');
    setProgress(null);
    const problems = [
      scrapeFailed ? `${scrapeFailed} failed to scrape` : '',
      refineFailed ? `${refineFailed} failed to refine` : '',
    ].filter(Boolean).join(', ');
    notify(
      `${refineAfter ? 'Scraped & refined' : 'Scraped'} ${total} ASIN${total === 1 ? '' : 's'}${problems ? ` — ${problems}` : ''}`,
      problems ? 'warning' : 'success'
    );
    loadItems();
  };

  const startReviewFromTable = (index) => {
    if (review.rows.length > 0 && !review.open && index == null) {
      setReview((prev) => ({ ...prev, open: true }));
      return;
    }
    openReview(items, index ?? 0);
  };

  const handleCloseReview = () => {
    if (busy) {
      setReview((prev) => ({ ...prev, open: false }));
      return;
    }
    const edited = review.rows.filter((row) => isDraftDirty(row, drafts[reviewRowKey(row)])).length;
    if ((edited || dismissed.size)
      && !window.confirm(`Discard ${edited} unsaved edit${edited === 1 ? '' : 's'} and ${dismissed.size} dismissal${dismissed.size === 1 ? '' : 's'}?`)) {
      return;
    }
    clearReview();
  };

  const handleToggleDismiss = (key) => setDismissed((prev) => {
    const next = new Set(prev);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    return next;
  });

  const handleSaveAll = async () => {
    const realRows = review.rows.filter((row) => !isStubRow(row));
    const toDelete = realRows.filter((row) => dismissed.has(reviewRowKey(row)));
    const toSave = realRows.filter((row) => !dismissed.has(reviewRowKey(row))
      && isDraftDirty(row, drafts[reviewRowKey(row)]));

    if (toSave.length === 0 && toDelete.length === 0) {
      clearReview();
      return;
    }
    if (toDelete.length > 0
      && !window.confirm(`Save ${toSave.length} edited row${toSave.length === 1 ? '' : 's'} and delete ${toDelete.length} dismissed row${toDelete.length === 1 ? '' : 's'}?`)) {
      return;
    }

    setSavingAll(true);
    const saved = [];
    const failures = [];
    for (const batch of chunk(toSave, 5)) {
      const results = await Promise.allSettled(batch.map((row) => {
        const draft = drafts[reviewRowKey(row)];
        return api.patch(`/etsy/asin-refine/${row._id}`,
          Object.fromEntries(REVIEW_EDITABLE_FIELDS.map((f) => [f, draft[f] ?? ''])));
      }));
      results.forEach((result, i) => {
        if (result.status === 'fulfilled') saved.push(result.value.data.item);
        else failures.push({ row: batch[i], error: result.reason?.response?.data?.error || 'Save failed' });
      });
    }

    let deleted = 0;
    if (toDelete.length > 0) {
      try {
        const { data } = await api.post('/etsy/asin-refine/delete', { ids: toDelete.map((row) => row._id) });
        deleted = data.deletedCount || 0;
      } catch (err) {
        failures.push({ row: toDelete[0], error: err.response?.data?.error || 'Delete failed' });
      }
    }
    setSavingAll(false);
    mergeItems(saved);

    if (failures.length > 0) {
      const savedKeys = new Set(saved.map(reviewRowKey));
      updateReviewRows(saved);
      setDrafts((prev) => Object.fromEntries(Object.entries(prev).filter(([key]) => !savedKeys.has(key))));
      const firstFailed = review.rows.findIndex((row) => reviewRowKey(row) === reviewRowKey(failures[0].row));
      if (firstFailed >= 0) setReview((prev) => ({ ...prev, index: firstFailed }));
      notify(`${failures.length} failed — ${failures[0].row.asin}: ${failures[0].error}`, 'error');
      return;
    }

    notify(`Saved ${saved.length} row${saved.length === 1 ? '' : 's'}${deleted ? `, deleted ${deleted}` : ''}`);
    clearReview();
    loadItems();
  };

  const handleCopy = async (text, label) => {
    try {
      await navigator.clipboard.writeText(text);
      notify(`${label} copied`);
    } catch {
      notify('Could not copy to clipboard', 'error');
    }
  };

  const handleRegenerateSku = async (item) => {
    try {
      const { data } = await api.post(`/etsy/asin-refine/${item._id}/regenerate-sku`);
      mergeItems([data.item]);
      notify(`New SKU: ${data.item.sku}`);
    } catch (err) {
      notify(err.response?.data?.error || 'Failed to regenerate SKU', 'error');
    }
  };

  const handleDelete = async (ids) => {
    if (!window.confirm(`Delete ${ids.length} row${ids.length === 1 ? '' : 's'}?`)) return;
    try {
      await api.post('/etsy/asin-refine/delete', { ids });
      setSelected(new Set());
      notify(`Deleted ${ids.length} row${ids.length === 1 ? '' : 's'}`);
      loadItems();
    } catch (err) {
      notify(err.response?.data?.error || 'Delete failed', 'error');
    }
  };

  const allOnPageSelected = items.length > 0 && items.every((item) => selected.has(item._id));
  const toggleAll = () => setSelected(allOnPageSelected ? new Set() : new Set(items.map((item) => item._id)));
  const toggleOne = (id) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  });

  const exportItems = selected.size > 0 ? items.filter((item) => selected.has(item._id)) : items;
  const hasPrompt = Boolean(prompt.trim());

  return (
    <AdminPageShell>
      <PageHeader
        title="ASIN Refine"
        description="Paste ASINs to scrape Amazon data, rewrite titles and descriptions with OpenAI, and get a unique SKU per ASIN."
        sx={{ pt: 0, pb: 1 }}
      />

      <Paper sx={{ p: 2, mb: 2 }}>
          <TextField
            label="ASINs"
            placeholder="Paste ASINs — one per line, or separated by commas / spaces"
            value={asinText}
            onChange={(e) => setAsinText(e.target.value)}
            multiline
            minRows={3}
            maxRows={8}
            fullWidth
            disabled={busy}
            sx={{ '& textarea': { fontFamily: 'monospace' } }}
          />
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 1.5 }} flexWrap="wrap" useFlexGap>
            <TextField
              select
              size="small"
              label="Etsy Store"
              value={storesLoading ? '' : selectedStoreId}
              onChange={(e) => {
                setSelectedStoreId(e.target.value);
                setPage(0);
                setSelected(new Set());
              }}
              disabled={busy || storesLoading}
              sx={{ minWidth: 180 }}
            >
              {stores.length === 0 ? (
                <MenuItem value="" disabled>No stores yet</MenuItem>
              ) : [
                <MenuItem key={ALL_STORES_VALUE} value={ALL_STORES_VALUE}>All Stores</MenuItem>,
                ...stores.map((store) => (
                  <MenuItem key={store._id} value={store._id}>{store.name}</MenuItem>
                )),
              ]}
            </TextField>
            <TextField
              select
              size="small"
              label="Marketplace"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              disabled={busy}
              sx={{ width: 130 }}
            >
              {REGIONS.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
            <Button
              variant="contained"
              startIcon={<CloudDownloadIcon />}
              onClick={handleScrape}
              disabled={busy || parsed.valid.length === 0 || !canScrapeStore || (autoRefine && !hasPrompt)}
            >
              {autoRefine ? 'Scrape & Refine' : 'Scrape'}
              {parsed.valid.length > 0 ? ` ${parsed.valid.length} ASIN${parsed.valid.length === 1 ? '' : 's'}` : ''}
            </Button>
            {isAllStores && stores.length > 0 && (
              <Typography variant="caption" color="text.secondary">
                Pick a store to save into
              </Typography>
            )}
            <FormControlLabel
              control={(
                <Checkbox
                  size="small"
                  checked={autoRefine}
                  onChange={(e) => setAutoRefine(e.target.checked)}
                  disabled={busy}
                />
              )}
              label={<Typography variant="body2">Refine with AI</Typography>}
            />
            {parsed.invalid.length > 0 && (
              <Typography variant="caption" color="error">
                Skipping {parsed.invalid.length} invalid: {parsed.invalid.slice(0, 3).join(', ')}
                {parsed.invalid.length > 3 ? '…' : ''}
              </Typography>
            )}
            <Box sx={{ flex: 1 }} />
            <Typography variant="body2" color="text.secondary">Listing prompt:</Typography>
            <Chip
              size="small"
              color={prompt === DEFAULT_ASIN_REFINE_PROMPT ? 'default' : 'info'}
              label={prompt === DEFAULT_ASIN_REFINE_PROMPT ? 'Master prompt' : 'Custom prompt'}
            />
            <Button size="small" startIcon={<EditNoteIcon />} onClick={() => setPromptOpen(true)} disabled={busy}>
              Edit prompt
            </Button>
            <Typography variant="body2" color="text.secondary" sx={{ ml: { md: 1 } }}>Image prompt:</Typography>
            <Chip
              size="small"
              color={imagePrompt === DEFAULT_ASIN_REFINE_IMAGE_PROMPT ? 'default' : 'info'}
              label={imagePrompt === DEFAULT_ASIN_REFINE_IMAGE_PROMPT ? 'Image Prompt' : 'Custom image prompt'}
            />
            <Button size="small" startIcon={<EditNoteIcon />} onClick={() => setImagePromptOpen(true)} disabled={busy}>
              Edit prompt
            </Button>
          </Stack>
      </Paper>

      <Dialog open={promptOpen} onClose={() => setPromptOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>OpenAI listing prompt</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            One prompt builds the whole listing: title, description, material, color, tags and warning.
            The scraped title and description are sent with it automatically (or place them yourself
            with {'{title}'} and {'{description}'}). Changes are saved as you type.
          </Typography>
          <TextField
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            multiline
            minRows={16}
            maxRows={28}
            fullWidth
            autoFocus
            sx={{ '& textarea': { fontSize: '0.85rem' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setPrompt(DEFAULT_ASIN_REFINE_PROMPT)}
            disabled={prompt === DEFAULT_ASIN_REFINE_PROMPT}
          >
            Reset to master prompt
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={() => setPromptOpen(false)} disabled={!prompt.trim()}>Done</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={imagePromptOpen} onClose={() => setImagePromptOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>OpenAI image prompt</DialogTitle>
        <DialogContent>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
            Used when editing product photos: new themed background, store name on the image, keep the
            product itself unchanged. Edits are saved as you type.
          </Typography>
          <TextField
            value={imagePrompt}
            onChange={(e) => setImagePrompt(e.target.value)}
            multiline
            minRows={16}
            maxRows={28}
            fullWidth
            autoFocus
            sx={{ '& textarea': { fontSize: '0.85rem' } }}
          />
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setImagePrompt(DEFAULT_ASIN_REFINE_IMAGE_PROMPT)}
            disabled={imagePrompt === DEFAULT_ASIN_REFINE_IMAGE_PROMPT}
          >
            Reset to master prompt
          </Button>
          <Box sx={{ flex: 1 }} />
          <Button variant="contained" onClick={() => setImagePromptOpen(false)} disabled={!imagePrompt.trim()}>Done</Button>
        </DialogActions>
      </Dialog>

      {progress && (
        <Paper sx={{ p: 1.5, mb: 2 }}>
          <Typography variant="body2" sx={{ mb: 0.75 }}>
            {progress.label} {progress.done} / {progress.total}…
          </Typography>
          <LinearProgress
            variant="determinate"
            value={progress.total ? (progress.done / progress.total) * 100 : 0}
          />
        </Paper>
      )}

      <Paper>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ p: 1.5 }} flexWrap="wrap" useFlexGap>
          <TextField
            size="small"
            label="Search ASIN, SKU, title, brand, material, color or tags"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            sx={{ minWidth: 280 }}
          />
          <Box sx={{ flex: 1 }} />
          {selected.size > 0 && (
            <Typography variant="body2" color="text.secondary">{selected.size} selected</Typography>
          )}
          <Button
            size="small"
            variant="contained"
            startIcon={<RateReviewIcon />}
            onClick={() => {
              if (review.rows.length > 0) {
                setReview((prev) => ({ ...prev, open: true }));
              } else if (selected.size > 0) {
                openReview(items.filter((item) => selected.has(item._id)));
              } else {
                openReview(items);
              }
            }}
            disabled={review.rows.length === 0 && items.length === 0}
          >
            {review.rows.length > 0
              ? `Resume review (${review.rows.length})`
              : selected.size > 0 ? `Review ${selected.size} selected` : 'Review'}
          </Button>
          <Button
            size="small"
            startIcon={<FileDownloadIcon />}
            onClick={() => exportCsv(exportItems)}
            disabled={exportItems.length === 0}
          >
            Export CSV{selected.size > 0 ? ` (${selected.size})` : ''}
          </Button>
          <Button
            size="small"
            color="error"
            startIcon={<DeleteIcon />}
            onClick={() => handleDelete([...selected])}
            disabled={selected.size === 0 || busy}
          >
            Delete
          </Button>
          <Tooltip title="Reload">
            <IconButton size="small" onClick={loadItems} disabled={loading}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Stack>

        <TableContainer sx={{ maxHeight: 'calc(100vh - 260px)' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell padding="checkbox" sx={headerCellSx}>
                  <Checkbox
                    size="small"
                    checked={allOnPageSelected}
                    indeterminate={selected.size > 0 && !allOnPageSelected}
                    onChange={toggleAll}
                    sx={{ color: 'inherit' }}
                  />
                </TableCell>
                <TableCell sx={headerCellSx}>Images</TableCell>
                <TableCell sx={headerCellSx}>Store</TableCell>
                <TableCell sx={headerCellSx}>ASIN / SKU</TableCell>
                <TableCell sx={headerCellSx}>Brand / Price</TableCell>
                <TableCell sx={{ ...headerCellSx, minWidth: 280 }}>Title</TableCell>
                <TableCell sx={{ ...headerCellSx, minWidth: 340 }}>Description</TableCell>
                <TableCell sx={{ ...headerCellSx, minWidth: 120 }}>Material</TableCell>
                <TableCell sx={{ ...headerCellSx, minWidth: 120 }}>Color</TableCell>
                <TableCell sx={{ ...headerCellSx, minWidth: 260 }}>Tags</TableCell>
                <TableCell sx={headerCellSx}>Status</TableCell>
                <TableCell sx={headerCellSx} align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 6 }}><CircularProgress size={28} /></TableCell>
                </TableRow>
              )}
              {!loading && items.length === 0 && (
                <TableRow>
                  <TableCell colSpan={12} align="center" sx={{ py: 6 }}>
                    <Typography color="text.secondary">
                      {search ? 'No rows match your search.' : 'No ASINs yet — paste some above and click Scrape.'}
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {items.map((item, rowIndex) => {
                const status = STATUS_CHIP[item.status] || STATUS_CHIP.pending;
                return (
                  <TableRow key={item._id} hover selected={selected.has(item._id)} sx={{ verticalAlign: 'top' }}>
                    <TableCell padding="checkbox">
                      <Checkbox size="small" checked={selected.has(item._id)} onChange={() => toggleOne(item._id)} />
                    </TableCell>
                    <TableCell>
                      {item.images?.length > 0 ? (
                        <Box
                          onClick={() => setGalleryItem(item)}
                          sx={{ position: 'relative', width: 64, height: 64, cursor: 'pointer' }}
                        >
                          <Box
                            component="img"
                            src={item.images[0]}
                            alt=""
                            loading="lazy"
                            sx={{ width: 64, height: 64, objectFit: 'contain', borderRadius: 1, border: '1px solid', borderColor: 'divider', bgcolor: '#fff' }}
                          />
                          <Chip
                            label={item.images.length}
                            size="small"
                            sx={{ position: 'absolute', bottom: -6, right: -6, height: 18, fontSize: '0.65rem' }}
                          />
                        </Box>
                      ) : (
                        <Typography variant="caption" color="text.disabled">—</Typography>
                      )}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.storeName || '—'}</Typography>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Stack direction="row" alignItems="center" spacing={0.25}>
                        <Typography
                          variant="body2"
                          component="a"
                          href={`https://www.amazon.${AMAZON_DOMAIN[item.region] || 'com'}/dp/${item.asin}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          sx={{ fontFamily: 'monospace', color: 'primary.main' }}
                        >
                          {item.asin}
                        </Typography>
                        <CopyButton text={item.asin} label="ASIN" onCopy={handleCopy} />
                      </Stack>
                      <Stack direction="row" alignItems="center" spacing={0.25} sx={{ mt: 0.5 }}>
                        <Typography variant="body2" fontWeight={700} sx={{ fontFamily: 'monospace' }}>
                          {item.sku}
                        </Typography>
                        <CopyButton text={item.sku} label="SKU" onCopy={handleCopy} />
                        <Tooltip title="New random SKU">
                          <IconButton size="small" onClick={() => handleRegenerateSku(item)} sx={{ p: 0.25 }}>
                            <ShuffleIcon sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                      <Typography variant="caption" color="text.secondary">{item.region}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">{item.brand || '—'}</Typography>
                      <Typography variant="body2" fontWeight={600}>{formatPrice(item.price, item.region)}</Typography>
                    </TableCell>
                    <TableCell onClick={() => startReviewFromTable(rowIndex)} sx={{ cursor: 'pointer' }}>
                      {item.refinedTitle && (
                        <Stack direction="row" alignItems="flex-start" spacing={0.25} sx={{ mb: 0.75 }}>
                          <Typography variant="body2" fontWeight={600} sx={clampSx(3)}>{item.refinedTitle}</Typography>
                          <CopyButton text={item.refinedTitle} label="Refined title" onCopy={handleCopy} />
                        </Stack>
                      )}
                      <Stack direction="row" alignItems="flex-start" spacing={0.25}>
                        <Typography
                          variant={item.refinedTitle ? 'caption' : 'body2'}
                          color={item.refinedTitle ? 'text.secondary' : 'text.primary'}
                          sx={clampSx(item.refinedTitle ? 2 : 3)}
                        >
                          {item.refinedTitle ? 'Original: ' : ''}{item.title || '—'}
                        </Typography>
                        <CopyButton text={item.title} label="Title" onCopy={handleCopy} />
                      </Stack>
                    </TableCell>
                    <TableCell onClick={() => startReviewFromTable(rowIndex)} sx={{ cursor: 'pointer' }}>
                      {item.refinedDescription && (
                        <Stack direction="row" alignItems="flex-start" spacing={0.25} sx={{ mb: 0.75 }}>
                          <Typography variant="body2" sx={clampSx(4)}>{item.refinedDescription}</Typography>
                          <CopyButton text={item.refinedDescription} label="Refined description" onCopy={handleCopy} />
                        </Stack>
                      )}
                      <Stack direction="row" alignItems="flex-start" spacing={0.25}>
                        <Typography
                          variant={item.refinedDescription ? 'caption' : 'body2'}
                          color={item.refinedDescription ? 'text.secondary' : 'text.primary'}
                          sx={clampSx(item.refinedDescription ? 2 : 4)}
                        >
                          {item.refinedDescription ? 'Original: ' : ''}{item.description || '—'}
                        </Typography>
                        <CopyButton text={item.description} label="Description" onCopy={handleCopy} />
                      </Stack>
                    </TableCell>
                    <TableCell onClick={() => startReviewFromTable(rowIndex)} sx={{ cursor: 'pointer' }}>
                      <AttributeValue label="Material" value={item.material} onCopy={handleCopy} />
                    </TableCell>
                    <TableCell onClick={() => startReviewFromTable(rowIndex)} sx={{ cursor: 'pointer' }}>
                      <AttributeValue label="Color" value={item.color} onCopy={handleCopy} />
                    </TableCell>
                    <TableCell onClick={() => startReviewFromTable(rowIndex)} sx={{ cursor: 'pointer' }}>
                      <TagCell tags={item.tags} onCopy={handleCopy} />
                    </TableCell>
                    <TableCell>
                      <Chip label={status.label} color={status.color} size="small" />
                      {item.error && (
                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5, maxWidth: 160 }}>
                          {item.error}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Review scraped vs revised">
                        <IconButton size="small" color="primary" onClick={() => startReviewFromTable(rowIndex)}>
                          <RateReviewIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Delete">
                        <IconButton size="small" color="error" onClick={() => handleDelete([item._id])}>
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={total}
          page={page}
          onPageChange={(_, next) => { setPage(next); setSelected(new Set()); }}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          rowsPerPageOptions={[25, 50, 100, 200]}
        />
      </Paper>

      {review.rows.length > 0 && (
        <AsinRefineReviewDialog
          open={review.open}
          rows={review.rows}
          index={review.index}
          onIndexChange={(index) => setReview((prev) => ({ ...prev, index }))}
          drafts={drafts}
          onDraftChange={(key, draft) => setDrafts((prev) => ({ ...prev, [key]: draft }))}
          dismissed={dismissed}
          onToggleDismiss={handleToggleDismiss}
          onRowUpdated={(item) => { mergeItems([item]); updateReviewRows([item]); }}
          onSaveAll={handleSaveAll}
          savingAll={savingAll}
          progress={progress}
          onClose={handleCloseReview}
          onCopy={handleCopy}
          notify={notify}
          prompt={prompt}
          amazonUrl={(item) => `https://www.amazon.${AMAZON_DOMAIN[item.region] || 'com'}/dp/${item.asin}`}
          formatPrice={formatPrice}
        />
      )}

      <Dialog open={Boolean(galleryItem)} onClose={() => setGalleryItem(null)} maxWidth="md" fullWidth>
        <DialogTitle>
          {galleryItem?.asin} — {galleryItem?.images?.length} image{galleryItem?.images?.length === 1 ? '' : 's'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 1.5, mt: 1 }}>
            {galleryItem?.images?.map((url, index) => (
              <Box key={url} sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, bgcolor: '#fff' }}>
                <Box component="a" href={url} target="_blank" rel="noopener noreferrer">
                  <Box component="img" src={url} alt="" loading="lazy" sx={{ width: '100%', height: 150, objectFit: 'contain' }} />
                </Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between">
                  <Typography variant="caption" color="text.secondary">Image {index + 1}</Typography>
                  <CopyButton text={url} label={`Image ${index + 1} URL`} onCopy={handleCopy} />
                </Stack>
              </Box>
            ))}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={() => handleCopy(galleryItem.images.join('\n'), 'All image URLs')}
          >
            Copy all URLs
          </Button>
          <Button onClick={() => setGalleryItem(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar((prev) => ({ ...prev, open: false }))} variant="filled">
          {snackbar.message}
        </Alert>
      </Snackbar>
    </AdminPageShell>
  );
}
