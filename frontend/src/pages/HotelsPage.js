import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Card, CardContent, Grid, Chip, TextField, MenuItem, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment } from '@mui/material';
import { Add, Hotel, Search } from '@mui/icons-material';
import api from '../services/api';
import BulkImport from '../components/BulkImport';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useForm } from 'react-hook-form';

export default function HotelsPage() {
  const { isAdmin } = useAuth();
  const [hotels, setHotels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [cityFilter, setCityFilter] = useState('');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const load = () => {
    setLoading(true);
    api.get('/hotels', { params: { ...(cityFilter && { city: cityFilter }), ...(search && { search }) } }).then((r) => setHotels(r.data || [])).catch((err) => toast.error(err.response?.data?.error || 'Failed to load hotels')).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [cityFilter, search]);

  const openCreate = () => { setEditing(null); reset({ city: 'MAKKAH', stars: 4, amenities: [] }); setOpen(true); };
  const openEdit = (h) => { setEditing(h); reset({ ...h, amenities: h.amenities?.join(', ') || '' }); setOpen(true); };

  const onSubmit = async (data) => {
    const payload = { ...data, stars: Number(data.stars), amenities: data.amenities ? String(data.amenities).split(',').map((a) => a.trim()).filter(Boolean) : [] };
    try {
      if (editing) await api.put(`/hotels/${editing.id}`, payload);
      else await api.post('/hotels', payload);
      toast.success(editing ? 'Hotel updated' : 'Hotel added');
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save hotel');
    }
  };

  const cityColor = { MAKKAH: '#7c3aed', MADINAH: '#0e9f6e' };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Hotels</Typography>
        {isAdmin && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <BulkImport entity="hotels" label="Hotels" onDone={load} />
            <Button variant="contained" startIcon={<Add />} onClick={openCreate}>Add Hotel</Button>
          </Box>
        )}
      </Box>

      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <TextField placeholder="Search hotels..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ flex: 1 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
        <TextField select label="City" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)} sx={{ width: 160 }}>
          <MenuItem value="">All Cities</MenuItem>
          <MenuItem value="MAKKAH">Makkah</MenuItem>
          <MenuItem value="MADINAH">Madinah</MenuItem>
        </TextField>
      </Box>

      {loading ? <Box sx={{ textAlign: 'center', mt: 4 }}><CircularProgress /></Box> : (
        <Grid container spacing={2}>
          {hotels.map((h) => (
            <Grid item xs={12} sm={6} md={4} key={h.id}>
              <Card>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                    <Chip label={h.city} size="small" sx={{ bgcolor: cityColor[h.city] + '22', color: cityColor[h.city], fontWeight: 700 }} />
                    <Typography variant="body1">{'★'.repeat(h.stars)}</Typography>
                  </Box>
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>{h.name}</Typography>
                  <Typography variant="caption" color="text.secondary" display="block">{h.address}</Typography>
                  {h.description && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>{h.description}</Typography>}
                  {h.amenities?.length > 0 && (
                    <Box sx={{ mt: 1.5, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {h.amenities.map((a) => <Chip key={a} label={a} size="small" variant="outlined" />)}
                    </Box>
                  )}
                  {isAdmin && <Button size="small" sx={{ mt: 1.5 }} onClick={() => openEdit(h)}>Edit</Button>}
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Hotel' : 'Add Hotel'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField fullWidth label="Hotel Name *" error={!!errors.name} {...register('name', { required: true })} /></Grid>
              <Grid item xs={6}><TextField fullWidth select label="City" defaultValue="MAKKAH" {...register('city')}><MenuItem value="MAKKAH">Makkah</MenuItem><MenuItem value="MADINAH">Madinah</MenuItem></TextField></Grid>
              <Grid item xs={6}><TextField fullWidth select label="Stars" defaultValue={4} {...register('stars', { valueAsNumber: true })}>{[1, 2, 3, 4, 5].map((s) => <MenuItem key={s} value={s}>{s} Star{s > 1 ? 's' : ''}</MenuItem>)}</TextField></Grid>
              <Grid item xs={12}><TextField fullWidth label="Address" {...register('address')} /></Grid>
              <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Description" {...register('description')} /></Grid>
              <Grid item xs={12}><TextField fullWidth label="Amenities (comma-separated)" helperText="e.g. WiFi, Pool, Spa, Restaurant" {...register('amenities')} /></Grid>
            </Grid>
          </DialogContent>
          <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
