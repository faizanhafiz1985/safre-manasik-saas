import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Card, CardContent, Grid, Chip, TextField, InputAdornment, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, MenuItem, IconButton, Accordion, AccordionSummary, AccordionDetails, Divider } from '@mui/material';
import { Add, Search, Edit, Hotel, DirectionsBus, Restaurant, ExpandMore, CheckCircle, Cancel } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useForm, useFieldArray } from 'react-hook-form';
import api from '../services/api';
import { toast } from 'react-toastify';
import { fmtCurrency } from '../utils/helpers';
import { numericOnly, decimalOnly } from '../utils/validation';

const ROOM_TYPES = ['QUAD', 'TRIPLE', 'DOUBLE', 'SINGLE', 'SUITE', 'FAMILY_SUITE', 'VIP'];

export default function PackagesPage() {
  const { isAdmin } = useAuth();
  const [packages, setPackages] = useState([]);
  const [hotels, setHotels] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const { register, handleSubmit, reset, control, formState: { errors } } = useForm({
    defaultValues: { priceTiers: [{ tierName: '', pricePerPax: '', roomType: 'DOUBLE', minPax: 1 }], packageHotels: [] },
  });
  const { fields: tierFields, append: addTier, remove: removeTier } = useFieldArray({ control, name: 'priceTiers' });
  const { fields: hotelFields, append: addHotel, remove: removeHotel } = useFieldArray({ control, name: 'packageHotels' });

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/packages'), api.get('/hotels')]).catch(()=>[{data:{data:[]}},{data:[]}]).then(([p, h]) => {
      setPackages(p.data.data || []);
      setHotels(h.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const openCreate = () => { setEditing(null); reset({ name: '', durationDays: 10, description: '', transportIncluded: true, cateringIncluded: true, visaIncluded: true, airportTransfer: true, priceTiers: [{ tierName: 'Double Room', pricePerPax: '', roomType: 'DOUBLE', minPax: 2 }], packageHotels: [] }); setOpen(true); };
  const openEdit = (pkg) => {
    setEditing(pkg);
    reset({
      ...pkg,
      priceTiers: pkg.priceTiers || [],
      packageHotels: pkg.packageHotels?.map(({ hotelId, city, nights }) => ({ hotelId, city, nights })) || [],
    });
    setOpen(true);
  };

  const onSubmit = async (data) => {
    try {
      // Strip stale ids from nested records before sending to backend
      const payload = {
        ...data,
        priceTiers: (data.priceTiers || []).map(({ tierName, pricePerPax, roomType, minPax, maxPax }) => ({ tierName, pricePerPax, roomType, minPax, maxPax })),
        packageHotels: (data.packageHotels || []).map(({ hotelId, city, nights }) => ({ hotelId, city, nights })),
      };
      if (editing) await api.put(`/packages/${editing.id}`, payload);
      else await api.post('/packages', payload);
      toast.success(editing ? 'Package updated' : 'Package created');
      setOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save package');
    }
  };

  const toggleActive = async (pkg) => {
    try {
      await api.put(`/packages/${pkg.id}`, {
        name: pkg.name, description: pkg.description, durationDays: pkg.durationDays,
        transportIncluded: pkg.transportIncluded, cateringIncluded: pkg.cateringIncluded,
        visaIncluded: pkg.visaIncluded, airportTransfer: pkg.airportTransfer,
        isActive: !pkg.isActive,
        priceTiers:    (pkg.priceTiers || []).map(({ tierName, pricePerPax, roomType, minPax, maxPax }) => ({ tierName, pricePerPax, roomType, minPax, maxPax })),
        packageHotels: (pkg.packageHotels || []).map(({ hotelId, city, nights }) => ({ hotelId, city, nights })),
      });
      toast.success(`Package ${!pkg.isActive ? 'activated' : 'deactivated'}`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update package');
    }
  };

  const filtered = packages.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Umrah Packages</Typography>
        {isAdmin && <Button variant="contained" startIcon={<Add />} onClick={openCreate}>New Package</Button>}
      </Box>

      <TextField fullWidth placeholder="Search packages..." value={search} onChange={(e) => setSearch(e.target.value)} sx={{ mb: 3 }}
        InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />

      {loading ? <Box sx={{ textAlign: 'center', mt: 6 }}><CircularProgress /></Box> : (
        <Grid container spacing={3}>
          {filtered.map((pkg) => (
            <Grid item xs={12} md={6} lg={4} key={pkg.id}>
              <Card sx={{ opacity: pkg.isActive ? 1 : 0.6, position: 'relative', height: '100%', display: 'flex', flexDirection: 'column' }}>
                {!pkg.isActive && <Chip label="Inactive" size="small" color="error" sx={{ position: 'absolute', top: 12, right: 12 }} />}
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="subtitle1" fontWeight={700} gutterBottom>{pkg.name}</Typography>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>{pkg.description}</Typography>

                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mb: 2 }}>
                    <Chip icon={<Hotel fontSize="small" />} label={`${pkg.durationDays} Days`} size="small" color="primary" variant="outlined" />
                    {pkg.transportIncluded && <Chip icon={<DirectionsBus fontSize="small" />} label="Transport" size="small" color="success" variant="outlined" />}
                    {pkg.cateringIncluded && <Chip icon={<Restaurant fontSize="small" />} label="Catering" size="small" color="secondary" variant="outlined" />}
                    {pkg.visaIncluded && <Chip label="Visa" size="small" variant="outlined" />}
                  </Box>

                  {pkg.packageHotels?.length > 0 && (
                    <Box sx={{ mb: 2 }}>
                      {pkg.packageHotels.map((ph) => (
                        <Typography key={ph.id} variant="caption" color="text.secondary" display="block">
                          {ph.city}: {ph.hotel?.name} ({ph.nights} nights) {'★'.repeat(ph.hotel?.stars || 0)}
                        </Typography>
                      ))}
                    </Box>
                  )}

                  {pkg.priceTiers?.length > 0 && (
                    <Box sx={{ bgcolor: '#f8fafc', borderRadius: 1, p: 1.5 }}>
                      <Typography variant="caption" fontWeight={700} color="primary.main" display="block" sx={{ mb: 0.5 }}>Pricing</Typography>
                      {pkg.priceTiers.map((t) => (
                        <Box key={t.id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Typography variant="caption" color="text.secondary">{t.tierName}</Typography>
                          <Typography variant="caption" fontWeight={700}>{fmtCurrency(t.pricePerPax)}/pax</Typography>
                        </Box>
                      ))}
                    </Box>
                  )}
                </CardContent>

                {isAdmin && (
                  <Box sx={{ px: 2, pb: 2, display: 'flex', gap: 1 }}>
                    <Button size="small" startIcon={<Edit />} onClick={() => openEdit(pkg)}>Edit</Button>
                    <Button size="small" color={pkg.isActive ? 'error' : 'success'} startIcon={pkg.isActive ? <Cancel /> : <CheckCircle />} onClick={() => toggleActive(pkg)}>
                      {pkg.isActive ? 'Deactivate' : 'Activate'}
                    </Button>
                  </Box>
                )}
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editing ? 'Edit Package' : 'New Package'}</DialogTitle>
        <form onSubmit={handleSubmit(onSubmit)}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={8}><TextField fullWidth label="Package Name *" error={!!errors.name} helperText={errors.name?.message} {...register('name', { required: 'Name required' })} /></Grid>
              <Grid item xs={12} sm={4}><TextField fullWidth label="Duration (Days)" type="number" inputProps={{ min: 1, onKeyDown: numericOnly }} {...register('durationDays', { valueAsNumber: true, min: { value: 1, message: 'Min 1 day' } })} /></Grid>
              <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Description" {...register('description')} /></Grid>
              <Grid item xs={6} sm={3}><TextField fullWidth select label="Transport" defaultValue="true" {...register('transportIncluded')}><MenuItem value="true">Yes</MenuItem><MenuItem value="false">No</MenuItem></TextField></Grid>
              <Grid item xs={6} sm={3}><TextField fullWidth select label="Catering" defaultValue="true" {...register('cateringIncluded')}><MenuItem value="true">Yes</MenuItem><MenuItem value="false">No</MenuItem></TextField></Grid>
              <Grid item xs={6} sm={3}><TextField fullWidth select label="Visa" defaultValue="true" {...register('visaIncluded')}><MenuItem value="true">Yes</MenuItem><MenuItem value="false">No</MenuItem></TextField></Grid>
              <Grid item xs={6} sm={3}><TextField fullWidth select label="Airport Transfer" defaultValue="true" {...register('airportTransfer')}><MenuItem value="true">Yes</MenuItem><MenuItem value="false">No</MenuItem></TextField></Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">Price Tiers</Typography>
              <Button size="small" startIcon={<Add />} onClick={() => addTier({ tierName: '', pricePerPax: '', roomType: 'DOUBLE', minPax: 1 })}>Add Tier</Button>
            </Box>
            {tierFields.map((field, i) => (
              <Grid container spacing={1.5} key={field.id} sx={{ mb: 1 }}>
                <Grid item xs={4}><TextField fullWidth size="small" label="Tier Name" {...register(`priceTiers.${i}.tierName`)} /></Grid>
                <Grid item xs={3}><TextField fullWidth size="small" label="Price/Pax" type="number" inputProps={{ min: 0, onKeyDown: decimalOnly }} {...register(`priceTiers.${i}.pricePerPax`, { valueAsNumber: true, min: { value: 0, message: 'Must be positive' } })} /></Grid>
                <Grid item xs={3}><TextField fullWidth select size="small" label="Room Type" defaultValue="DOUBLE" {...register(`priceTiers.${i}.roomType`)}>{ROOM_TYPES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}</TextField></Grid>
                <Grid item xs={2}><Button color="error" size="small" onClick={() => removeTier(i)} sx={{ mt: 0.5 }}>Remove</Button></Grid>
              </Grid>
            ))}

            <Divider sx={{ my: 2 }} />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="subtitle2">Hotels</Typography>
              <Button size="small" startIcon={<Add />} onClick={() => addHotel({ hotelId: '', city: 'MAKKAH', nights: 5 })}>Add Hotel</Button>
            </Box>
            {hotelFields.map((field, i) => (
              <Grid container spacing={1.5} key={field.id} sx={{ mb: 1 }}>
                <Grid item xs={5}><TextField fullWidth select size="small" label="Hotel" {...register(`packageHotels.${i}.hotelId`)}>{hotels.map((h) => <MenuItem key={h.id} value={h.id}>{h.name}</MenuItem>)}</TextField></Grid>
                <Grid item xs={3}><TextField fullWidth select size="small" label="City" defaultValue="MAKKAH" {...register(`packageHotels.${i}.city`)}><MenuItem value="MAKKAH">Makkah</MenuItem><MenuItem value="MADINAH">Madinah</MenuItem></TextField></Grid>
                <Grid item xs={2}><TextField fullWidth size="small" label="Nights" type="number" inputProps={{ min: 1, onKeyDown: numericOnly }} {...register(`packageHotels.${i}.nights`, { valueAsNumber: true, min: { value: 1, message: 'Min 1' } })} /></Grid>
                <Grid item xs={2}><Button color="error" size="small" onClick={() => removeHotel(i)} sx={{ mt: 0.5 }}>Remove</Button></Grid>
              </Grid>
            ))}
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editing ? 'Update' : 'Create'}</Button>
          </DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
