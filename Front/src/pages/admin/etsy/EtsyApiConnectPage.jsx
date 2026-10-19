import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import RefreshIcon from '@mui/icons-material/Refresh';
import SearchIcon from '@mui/icons-material/Search';
import StorefrontIcon from '@mui/icons-material/Storefront';
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
  Grid,
  IconButton,
  InputAdornment,
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
import api, { getAuthToken } from '../../../lib/api.js';
import { getServerBaseUrl } from '../../../lib/serverBaseUrl.js';

const EMPTY_FORM = { name: '', subname: '' };

function etsyChip(store) {
  if (store.connected) {
    return <Chip label="Connected" size="small" color="info" variant="outlined" />;
  }
  return <Chip label="Not connected" size="small" color="warning" variant="outlined" />;
}

export default function EtsyApiConnectPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [stores, setStores] = useState([]);
  const [connections, setConnections] = useState([]);
  const [oauth, setOauth] = useState(null);
  const [ping, setPing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [editDialog, setEditDialog] = useState(null);
  const [editName, setEditName] = useState('');
  const [editSubname, setEditSubname] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [busyId, setBusyId] = useState('');
  const [keysOpen, setKeysOpen] = useState(false);
  const [keystring, setKeystring] = useState('');
  const [sharedSecret, setSharedSecret] = useState('');
  const [keysSaving, setKeysSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [storesRes, listRes, statusRes] = await Promise.all([
        api.get('/etsy/stores'),
        api.get('/etsy-api/connections').catch(() => ({ data: { connections: [] } })),
        api.get('/etsy-api/status').catch(() => ({ data: null })),
      ]);
      setStores(Array.isArray(storesRes.data?.stores) ? storesRes.data.stores : []);
      setConnections(Array.isArray(listRes.data?.connections) ? listRes.data.connections : []);
      setOauth(statusRes.data?.oauth || null);
      setPing(statusRes.data?.ping || null);
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to load Etsy stores');
      setStores([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const connected = searchParams.get('connected');
    const connectError = searchParams.get('etsyConnectError');
    if (connected) {
      setSuccess(`Connected Etsy shop: ${connected}`);
      void load();
      setSearchParams({}, { replace: true });
    } else if (connectError) {
      setError(connectError);
      setSearchParams({}, { replace: true });
    }
  }, [load, searchParams, setSearchParams]);

  const rows = useMemo(() => {
    return stores.map((store) => {
      const connection = connections.find((item) => String(item.store?.id || '') === String(store._id));
      return {
        ...store,
        connection,
        connected: Boolean(connection?.connected),
        shopId: connection?.shopId || null,
        shopName: connection?.shopName || '',
        listingActiveCount: connection?.listingActiveCount ?? null,
        lastError: connection?.lastError || '',
      };
    }).sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
  }, [stores, connections]);

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((store) =>
      store.name?.toLowerCase().includes(q)
      || store.subname?.toLowerCase().includes(q)
      || store.shopName?.toLowerCase().includes(q)
      || String(store.shopId || '').includes(q)
    );
  }, [rows, search]);

  const startConnect = (storeId) => {
    const token = getAuthToken() || localStorage.getItem('auth_token');
    if (!token) {
      setError('Sign in again, then connect the Etsy store.');
      return;
    }
    if (!oauth?.configured) {
      setError('Add ETSY_API_KEYSTRING and ETSY_API_SHARED_SECRET to Back/.env, then restart the API.');
      return;
    }
    const params = new URLSearchParams({ token });
    if (storeId) params.set('storeId', storeId);
    window.location.href = `${getServerBaseUrl()}/api/etsy-api/connect?${params.toString()}`;
  };

  const handleAddStore = async (e, connectAfter = false) => {
    e.preventDefault();
    const name = form.name.replace(/\s+/g, ' ').trim();
    if (!name) {
      setError('Enter a store name');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const { data } = await api.post('/etsy/stores', {
        name,
        subname: form.subname.replace(/\s+/g, ' ').trim(),
      });
      const store = data.store;
      setForm(EMPTY_FORM);
      setSuccess(data.created ? `Store "${store.name}" created.` : `Store "${store.name}" already exists.`);
      await load();
      if (connectAfter && store?._id) {
        startConnect(store._id);
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to add store');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRename = async () => {
    if (!editDialog?._id) return;
    const name = editName.replace(/\s+/g, ' ').trim();
    if (!name) {
      setError('Store name is required');
      return;
    }

    setEditSaving(true);
    setError('');
    try {
      await api.patch(`/etsy/stores/${editDialog._id}`, {
        name,
        subname: editSubname.replace(/\s+/g, ' ').trim(),
      });
      setSuccess(`Updated "${name}"`);
      setEditDialog(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to update store');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget?._id) return;
    setDeleteSaving(true);
    setError('');
    try {
      await api.delete(`/etsy/stores/${deleteTarget._id}`);
      setSuccess(`Deleted "${deleteTarget.name}"`);
      setDeleteTarget(null);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to delete store');
    } finally {
      setDeleteSaving(false);
    }
  };

  const handleDisconnect = async (store) => {
    if (!store.connection?.id) return;
    if (!window.confirm(`Disconnect Etsy login for "${store.name}"? The local store stays.`)) return;
    setBusyId(store._id);
    setError('');
    try {
      await api.post(`/etsy-api/connections/${store.connection.id}/disconnect`);
      setSuccess(`Disconnected "${store.name}"`);
      await load();
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to disconnect store');
    } finally {
      setBusyId('');
    }
  };

  const handleSaveKeys = async () => {
    if (!keystring.trim() || !sharedSecret.trim()) {
      setError('Paste both the keystring and the shared secret. Etsy needs x-api-key as keystring:secret.');
      return;
    }
    setKeysSaving(true);
    setError('');
    try {
      const { data } = await api.post('/etsy-api/settings', {
        keystring: keystring.trim(),
        sharedSecret: sharedSecret.trim(),
        redirectUri: oauth?.redirectUri || '',
      });
      setOauth(data.oauth || null);
      setPing(data.ping || null);
      if (data.ping?.ok) {
        setSuccess('Etsy API key accepted.');
        setKeysOpen(false);
        setKeystring('');
        setSharedSecret('');
      } else {
        setError(data.ping?.error || 'Etsy still rejected this keystring or shared secret.');
      }
    } catch (err) {
      setError(err.response?.data?.error || err.message || 'Failed to save Etsy API keys');
    } finally {
      setKeysSaving(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h5" sx={{ fontWeight: 700 }}>Store Management</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Add Etsy stores, then connect each shop with the official Etsy API. Tokens stay on the server.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          <Chip
            size="small"
            color={ping?.ok ? 'success' : oauth?.configured ? 'warning' : 'default'}
            label={ping?.ok ? 'Etsy API ready' : oauth?.configured ? 'API key rejected' : 'API keys missing'}
            onClick={() => {
              setKeystring('');
              setSharedSecret('');
              setKeysOpen(true);
            }}
          />
          <Tooltip title="Refresh list">
            <span>
              <IconButton onClick={() => load()} disabled={loading} sx={{ border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                <RefreshIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Stack>
      </Stack>

      {!ping?.ok && (ping?.error || oauth?.configured) ? (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          {ping?.error || 'Etsy does not recognize this app key.'}
          {' '}
          Click <strong>API key rejected</strong> and paste the keystring and shared secret from
          {' '}
          <a href="https://www.etsy.com/developers/your-apps" target="_blank" rel="noreferrer">Manage your apps</a>.
          Also add this callback URL on the Etsy app (not localhost — Etsy requires a real domain):
          {' '}
          <Box component="span" sx={{ fontFamily: 'ui-monospace, Menlo, Consolas, monospace' }}>
            {oauth?.redirectUri || 'https://grow-api-a8ub.onrender.com/api/etsy-api/callback'}
          </Box>
          .
        </Alert>
      ) : null}
      {error ? (
        <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setError('')}>{error}</Alert>
      ) : null}
      {success ? (
        <Alert severity="success" sx={{ mb: 2, borderRadius: 2 }} onClose={() => setSuccess('')}>{success}</Alert>
      ) : null}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper variant="outlined" sx={{ p: 3, borderRadius: 2, position: { md: 'sticky' }, top: 16 }}>
            <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
              <AddIcon color="primary" fontSize="small" />
              <Typography variant="h6" sx={{ fontWeight: 600 }}>Add Store</Typography>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Creates a local store used by Fulfilment, Products, and ASIN Refine.
              Use <strong>Add & Connect</strong> to authorize the Etsy shop right away.
            </Typography>

            <Stack spacing={2} component="form" onSubmit={(e) => handleAddStore(e, false)}>
              <TextField
                label="Store name"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
                disabled={submitting}
                size="small"
                fullWidth
                placeholder="e.g. TheVeloraCraftStore"
              />
              <TextField
                label="Subname (optional)"
                value={form.subname}
                onChange={(e) => setForm((p) => ({ ...p, subname: e.target.value }))}
                disabled={submitting}
                size="small"
                fullWidth
                placeholder="Short name for SKUs"
              />
              <Button
                type="submit"
                variant="contained"
                disabled={submitting || !form.name.trim()}
                startIcon={submitting ? <CircularProgress size={18} color="inherit" /> : <AddIcon />}
              >
                {submitting ? 'Saving...' : 'Add Store'}
              </Button>
              <Button
                variant="outlined"
                disabled={submitting || !form.name.trim()}
                startIcon={<StorefrontIcon />}
                onClick={(e) => handleAddStore(e, true)}
              >
                Add & Connect
              </Button>
            </Stack>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <Box sx={{ p: 2, borderBottom: 1, borderColor: 'divider' }}>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ xs: 'stretch', sm: 'center' }} justifyContent="space-between">
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  All Stores ({filteredRows.length})
                </Typography>
                <TextField
                  size="small"
                  placeholder="Search store or shop..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  sx={{ minWidth: { sm: 260 } }}
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" color="action" />
                      </InputAdornment>
                    ),
                  }}
                />
              </Stack>
            </Box>

            <TableContainer sx={{ maxHeight: 'calc(100vh - 280px)' }}>
              <Table stickyHeader size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ width: 48, fontWeight: 600 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Store</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Subname</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Etsy</TableCell>
                    <TableCell align="right" sx={{ fontWeight: 600, minWidth: 160 }}>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6 }}>
                        <CircularProgress size={28} />
                      </TableCell>
                    </TableRow>
                  ) : filteredRows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} align="center" sx={{ py: 6, color: 'text.secondary' }}>
                        {search ? 'No stores match your search' : 'No stores yet — create one on the left'}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredRows.map((store, index) => (
                      <TableRow key={store._id} hover>
                        <TableCell sx={{ color: 'text.secondary' }}>{index + 1}</TableCell>
                        <TableCell>
                          <Typography sx={{ fontWeight: 600 }}>{store.name || '—'}</Typography>
                          {store.shopName && store.shopName !== store.name ? (
                            <Typography variant="caption" color="text.secondary">
                              {store.shopName}{store.shopId ? ` · ${store.shopId}` : ''}
                            </Typography>
                          ) : store.shopId ? (
                            <Typography variant="caption" color="text.secondary">ID {store.shopId}</Typography>
                          ) : null}
                        </TableCell>
                        <TableCell sx={{ color: 'text.secondary' }}>{store.subname || '—'}</TableCell>
                        <TableCell>{etsyChip(store)}</TableCell>
                        <TableCell align="right">
                          <Stack direction="row" spacing={0.5} justifyContent="flex-end">
                            <Tooltip title="Edit store">
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => {
                                    setError('');
                                    setEditDialog(store);
                                    setEditName(store.name || '');
                                    setEditSubname(store.subname || '');
                                  }}
                                >
                                  <EditOutlinedIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title={store.connected ? 'Reconnect Etsy shop' : 'Connect Etsy shop'}>
                              <span>
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => startConnect(store._id)}
                                  disabled={busyId === store._id}
                                >
                                  <StorefrontIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title={store.connected ? 'Disconnect Etsy login' : 'Not connected'}>
                              <span>
                                <IconButton
                                  size="small"
                                  onClick={() => handleDisconnect(store)}
                                  disabled={!store.connected || busyId === store._id}
                                >
                                  <LinkOffIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                            <Tooltip title="Delete store">
                              <span>
                                <IconButton
                                  size="small"
                                  color="error"
                                  onClick={() => setDeleteTarget(store)}
                                  disabled={busyId === store._id}
                                >
                                  <DeleteOutlineIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>
      </Grid>

      <Dialog
        open={Boolean(editDialog)}
        onClose={() => !editSaving && setEditDialog(null)}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle sx={{ fontWeight: 600 }}>
          Edit store — {editDialog?.name}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ pt: 0.5 }}>
            <TextField
              autoFocus
              margin="dense"
              label="Store name"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              fullWidth
              size="small"
              disabled={editSaving}
            />
            <TextField
              label="Subname"
              value={editSubname}
              onChange={(e) => setEditSubname(e.target.value)}
              fullWidth
              size="small"
              disabled={editSaving}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setEditDialog(null)} disabled={editSaving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void handleRename()}
            disabled={editSaving || !editName.trim()}
            startIcon={editSaving ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {editSaving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={Boolean(deleteTarget)} onClose={() => !deleteSaving && setDeleteTarget(null)} fullWidth maxWidth="xs">
        <DialogTitle sx={{ fontWeight: 600 }}>Delete store?</DialogTitle>
        <DialogContent dividers>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Delete <strong>{deleteTarget?.name}</strong>?
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Fulfilment, Profit Sheet, Products and ASIN Refine rows stay, but they will no longer
            be tied to this store. Daily order counts for this store will be deleted.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteSaving}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete} disabled={deleteSaving}>
            {deleteSaving ? 'Deleting...' : 'Delete store'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={keysOpen} onClose={() => !keysSaving && setKeysOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle sx={{ fontWeight: 600 }}>Etsy API keys</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">
              From Etsy → Manage your apps → grow-mentality, copy the keystring and shared secret.
              Every API call sends <code>x-api-key: keystring:secret</code>. On the Etsy app use
              Callback URLs (not Endpoints). Etsy rejects localhost and 127.0.0.1.
            </Typography>
            {oauth?.keystringMasked ? (
              <Typography variant="caption" color="text.secondary">
                Current keystring: {oauth.keystringMasked}
              </Typography>
            ) : null}
            <TextField
              autoFocus
              label="Keystring"
              value={keystring}
              onChange={(e) => setKeystring(e.target.value)}
              fullWidth
              size="small"
              disabled={keysSaving}
            />
            <TextField
              label="Shared secret"
              value={sharedSecret}
              onChange={(e) => setSharedSecret(e.target.value)}
              fullWidth
              size="small"
              disabled={keysSaving}
              autoComplete="off"
            />
            <TextField
              label="Callback URL"
              value={oauth?.redirectUri || 'https://grow-api-a8ub.onrender.com/api/etsy-api/callback'}
              fullWidth
              size="small"
              InputProps={{ readOnly: true }}
              helperText="Paste this exact URL into Etsy Callback URLs, then Save."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setKeysOpen(false)} disabled={keysSaving}>Cancel</Button>
          <Button
            variant="contained"
            onClick={() => void handleSaveKeys()}
            disabled={keysSaving || !keystring.trim() || !sharedSecret.trim()}
          >
            {keysSaving ? 'Checking…' : 'Save & test'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
