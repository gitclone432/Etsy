import { useCallback, useEffect, useMemo, useState } from 'react';
import AddIcon from '@mui/icons-material/Add';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import RefreshIcon from '@mui/icons-material/Refresh';
import SaveIcon from '@mui/icons-material/Save';
import StorefrontIcon from '@mui/icons-material/Storefront';
import {
  Alert,
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import api from '../../lib/api.js';

function usageSummary(counts = {}) {
  const parts = [
    counts.fulfilment ? `${counts.fulfilment} fulfilment` : '',
    counts.profitSheet ? `${counts.profitSheet} profit sheet` : '',
    counts.products ? `${counts.products} products` : '',
    counts.asinRefine ? `${counts.asinRefine} ASIN refine` : '',
    counts.dailyOrders ? `${counts.dailyOrders} daily order counts` : '',
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'no linked rows';
}

export default function EtsyStoresPage() {
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newStoreName, setNewStoreName] = useState('');
  const [newStoreSubname, setNewStoreSubname] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [editingId, setEditingId] = useState('');
  const [editingName, setEditingName] = useState('');
  const [editingSubname, setEditingSubname] = useState('');
  const [savingId, setSavingId] = useState('');
  const [deletingId, setDeletingId] = useState('');

  const loadStores = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get('/etsy/stores');
      setStores(Array.isArray(data.stores) ? data.stores : []);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load Etsy stores');
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStores();
  }, [loadStores]);

  const sortedStores = useMemo(
    () => [...stores].sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''))),
    [stores]
  );

  const handleAddStore = async () => {
    const trimmed = newStoreName.trim();
    if (!trimmed) {
      setError('Enter a store name');
      return;
    }

    setCreating(true);
    setError('');
    setMessage('');
    try {
      const { data } = await api.post('/etsy/stores', {
        name: trimmed,
        subname: newStoreSubname.trim(),
      });
      const store = data.store;
      if (!store) {
        throw new Error('Store was not returned');
      }

      setStores((prev) => {
        const exists = prev.some((item) => String(item._id) === String(store._id));
        if (exists) return prev;
        return [...prev, store].sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
      });
      setNewStoreName('');
      setNewStoreSubname('');
      setMessage(data.created ? `Store "${store.name}" added` : `Store "${store.name}" already exists`);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to add store');
    } finally {
      setCreating(false);
    }
  };

  const startRename = (store) => {
    setEditingId(store._id);
    setEditingName(store.name || '');
    setEditingSubname(store.subname || '');
    setError('');
  };

  const cancelRename = () => {
    setEditingId('');
    setEditingName('');
    setEditingSubname('');
  };

  const handleRename = async (store) => {
    const trimmed = editingName.replace(/\s+/g, ' ').trim();
    const nextSubname = editingSubname.replace(/\s+/g, ' ').trim();
    if (!trimmed) {
      setError('Enter a store name');
      return;
    }
    if (trimmed === (store.name || '') && nextSubname === (store.subname || '')) {
      cancelRename();
      return;
    }

    setSavingId(store._id);
    setError('');
    setMessage('');
    try {
      const { data } = await api.patch(`/etsy/stores/${store._id}`, { name: trimmed, subname: nextSubname });
      setStores((prev) => prev.map((item) => (
        String(item._id) === String(store._id) ? { ...item, ...data.store } : item
      )));
      setMessage(`Updated "${data.store.name}"`);
      cancelRename();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to rename store');
    } finally {
      setSavingId('');
    }
  };

  const handleDelete = async (store) => {
    const ok = window.confirm(
      `Delete "${store.name}"?\n\nOrder Fulfilment, Profit Sheet, Products and ASIN Refine rows stay, but they will no longer be tied to this store.\nDaily order counts for this store will be deleted.`
    );
    if (!ok) return;

    setDeletingId(store._id);
    setError('');
    setMessage('');
    try {
      const { data } = await api.delete(`/etsy/stores/${store._id}`);
      setStores((prev) => prev.filter((item) => String(item._id) !== String(store._id)));
      if (editingId === store._id) cancelRename();
      setMessage(`Deleted "${store.name}" (${usageSummary(data.counts)})`);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete store');
    } finally {
      setDeletingId('');
    }
  };

  return (
    <Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 2 }}>
        Etsy Stores
      </Typography>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
      {message ? <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert> : null}

      <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          alignItems={{ xs: 'stretch', sm: 'center' }}
          justifyContent="space-between"
        >
          <Typography variant="body2" color="text.secondary">
            Etsy shop names used in Order Fulfilment, Profit Sheet, Products, Daily Orders and ASIN Refine.
            Add, rename or delete them here.
          </Typography>
          <Button variant="outlined" startIcon={<RefreshIcon />} onClick={loadStores} disabled={loading}>
            {loading ? 'Loading...' : 'Refresh'}
          </Button>
        </Stack>
      </Paper>

      <Paper sx={{ p: 2, borderRadius: 2, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
          <TextField
            size="small"
            label="New store name"
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddStore();
            }}
            placeholder="e.g. Techvista"
            sx={{ minWidth: { sm: 280 } }}
          />
          <TextField
            size="small"
            label="Subname"
            value={newStoreSubname}
            onChange={(e) => setNewStoreSubname(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddStore();
            }}
            placeholder="Optional short name"
            sx={{ minWidth: { sm: 220 } }}
          />
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={handleAddStore}
            disabled={creating || !newStoreName.trim()}
          >
            {creating ? 'Adding...' : 'Add Store'}
          </Button>
        </Stack>
      </Paper>

      <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: 48 }} align="center">#</TableCell>
              <TableCell>Store Name</TableCell>
              <TableCell>Subname</TableCell>
              <TableCell>Created</TableCell>
              <TableCell align="right" sx={{ width: 120 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {sortedStores.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <StorefrontIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
                  <Typography variant="body2" color="text.secondary">
                    {loading ? 'Loading Etsy stores...' : 'No Etsy stores yet. Add one above.'}
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              sortedStores.map((store, index) => {
                const isEditing = editingId === store._id;
                const busy = savingId === store._id || deletingId === store._id;
                return (
                <TableRow key={store._id} hover>
                  <TableCell align="center" sx={{ color: 'text.secondary', fontWeight: 600 }}>
                    {index + 1}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <TextField
                        size="small"
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(store);
                          if (e.key === 'Escape') cancelRename();
                        }}
                        autoFocus
                        disabled={busy}
                        sx={{ minWidth: 240 }}
                      />
                    ) : store.name}
                  </TableCell>
                  <TableCell>
                    {isEditing ? (
                      <TextField
                        size="small"
                        value={editingSubname}
                        onChange={(e) => setEditingSubname(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleRename(store);
                          if (e.key === 'Escape') cancelRename();
                        }}
                        disabled={busy}
                        placeholder="Optional"
                        sx={{ minWidth: 180 }}
                      />
                    ) : (store.subname || '—')}
                  </TableCell>
                  <TableCell>
                    {store.createdAt ? new Date(store.createdAt).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                    {isEditing ? (
                      <>
                        <Tooltip title="Save">
                          <span>
                            <IconButton size="small" color="primary" onClick={() => handleRename(store)} disabled={busy || !editingName.trim()}>
                              <SaveIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Cancel">
                          <span>
                            <IconButton size="small" onClick={cancelRename} disabled={busy}>
                              <CancelIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    ) : (
                      <>
                        <Tooltip title="Rename">
                          <span>
                            <IconButton size="small" onClick={() => startRename(store)} disabled={busy || Boolean(editingId)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <span>
                            <IconButton size="small" color="error" onClick={() => handleDelete(store)} disabled={busy || Boolean(editingId)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                      </>
                    )}
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}
