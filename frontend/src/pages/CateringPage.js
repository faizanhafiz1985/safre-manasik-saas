import React, { useEffect, useState } from 'react';
import { Box, Typography, Button, Card, CardContent, Grid, Chip, Table, TableBody, TableCell, TableHead, TableRow, CircularProgress, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Tabs, Tab, Divider } from '@mui/material';
import { Add, Restaurant } from '@mui/icons-material';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';
import { useForm } from 'react-hook-form';
import { fmtCurrency } from '../utils/helpers';
import { PATTERNS, MESSAGES, alphaOnly, decimalOnly, numericOnly } from '../utils/validation';

const PHONE_SA = /^966[0-9]{9}$/;

const mealColor = { BREAKFAST: 'warning', LUNCH: 'primary', DINNER: 'secondary' };
const mealIcon = { BREAKFAST: '🌅', LUNCH: '🍽️', DINNER: '🌙' };

export default function CateringPage() {
  const { isAdmin } = useAuth();
  const [tab, setTab] = useState(0);
  const [vendors, setVendors] = useState([]);
  const [mealPlans, setMealPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [vendorDialog, setVendorDialog] = useState(false);
  const [mealDialog, setMealDialog] = useState(false);
  const [editVendor, setEditVendor] = useState(null);
  const [editMeal, setEditMeal] = useState(null);

  const { register: regVend, handleSubmit: hsVend, reset: resetVend, formState: { errors: errVend } } = useForm();
  const { register: regMeal, handleSubmit: hsMeal, reset: resetMeal, formState: { errors: errMeal } } = useForm();

  const load = () => {
    setLoading(true);
    Promise.all([api.get('/catering/vendors'), api.get('/catering/meal-plans')]).catch(()=>[{data:[]},{data:[]}]).then(([v, m]) => {
      setVendors(v.data || []);
      setMealPlans(m.data || []);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const onVendor = async (data) => {
    try {
      if (editVendor) await api.put(`/catering/vendors/${editVendor.id}`, data);
      else await api.post('/catering/vendors', data);
      toast.success('Vendor saved');
      setVendorDialog(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save vendor');
    }
  };

  const onMeal = async (data) => {
    try {
      if (editMeal) await api.put(`/catering/meal-plans/${editMeal.id}`, data);
      else await api.post('/catering/meal-plans', { ...data, pricePerPax: Number(data.pricePerPax) });
      toast.success('Meal plan saved');
      setMealDialog(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save meal plan');
    }
  };

  const openVendor = (v = null) => { setEditVendor(v); resetVend(v || {}); setVendorDialog(true); };
  const openMeal = (m = null) => { setEditMeal(m); resetMeal(m ? { ...m, vendorId: m.vendorId } : { mealType: 'BREAKFAST' }); setMealDialog(true); };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h5">Catering Management</Typography>
        {isAdmin && (
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button variant="outlined" startIcon={<Add />} onClick={() => openVendor()}>Add Vendor</Button>
            <Button variant="contained" startIcon={<Add />} onClick={() => openMeal()}>Add Meal Plan</Button>
          </Box>
        )}
      </Box>

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 3 }}>
        <Tab label={`Vendors (${vendors.length})`} />
        <Tab label={`Meal Plans (${mealPlans.length})`} />
      </Tabs>

      {loading ? <Box sx={{ textAlign: 'center', mt: 4 }}><CircularProgress /></Box> : (
        <>
          {tab === 0 && (
            <Grid container spacing={2}>
              {vendors.map((v) => (
                <Grid item xs={12} sm={6} md={4} key={v.id}>
                  <Card>
                    <CardContent>
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                        <Typography variant="h5">🍽️</Typography>
                        {!v.isActive && <Chip label="Inactive" size="small" color="error" />}
                      </Box>
                      <Typography variant="subtitle1" fontWeight={700}>{v.name}</Typography>
                      {v.speciality && <Typography variant="caption" color="text.secondary" display="block">{v.speciality}</Typography>}
                      <Divider sx={{ my: 1 }} />
                      <Typography variant="caption" display="block">Contact: {v.contactName}</Typography>
                      <Typography variant="caption" display="block">Phone: {v.phone}</Typography>
                      <Typography variant="caption" display="block" color="text.secondary">{v.address}</Typography>
                      <Typography variant="caption" display="block" fontWeight={600} sx={{ mt: 1 }}>{v.mealPlans?.length || 0} meal plans</Typography>
                      {isAdmin && <Button size="small" sx={{ mt: 1 }} onClick={() => openVendor(v)}>Edit</Button>}
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
          )}

          {tab === 1 && (
            <Card>
              <Table>
                <TableHead><TableRow><TableCell>Meal Plan</TableCell><TableCell>Type</TableCell><TableCell>Vendor</TableCell><TableCell>Description</TableCell><TableCell>Price/Pax</TableCell><TableCell>Status</TableCell>{isAdmin && <TableCell>Actions</TableCell>}</TableRow></TableHead>
                <TableBody>
                  {mealPlans.map((m) => (
                    <TableRow key={m.id} hover>
                      <TableCell fontWeight={600}>{m.name}</TableCell>
                      <TableCell><Chip label={`${mealIcon[m.mealType]} ${m.mealType}`} color={mealColor[m.mealType]} size="small" /></TableCell>
                      <TableCell>{m.vendor?.name}</TableCell>
                      <TableCell><Typography variant="caption">{m.description}</Typography></TableCell>
                      <TableCell fontWeight={600}>{fmtCurrency(m.pricePerPax)}</TableCell>
                      <TableCell><Chip label={m.isActive ? 'Active' : 'Inactive'} color={m.isActive ? 'success' : 'error'} size="small" /></TableCell>
                      {isAdmin && <TableCell><Button size="small" onClick={() => openMeal(m)}>Edit</Button></TableCell>}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </>
      )}

      <Dialog open={vendorDialog} onClose={() => setVendorDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editVendor ? 'Edit Vendor' : 'Add Vendor'}</DialogTitle>
        <form onSubmit={hsVend(onVendor)}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField fullWidth label="Vendor Name *" error={!!errVend.name} helperText={errVend.name?.message} {...regVend('name', { required: 'Name required' })} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Contact Person" inputProps={{ onKeyDown: alphaOnly }} error={!!errVend.contactName} helperText={errVend.contactName?.message} {...regVend('contactName', { pattern: { value: PATTERNS.ALPHA_ONLY, message: MESSAGES.ALPHA_ONLY } })} /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Phone"
                  error={!!errVend.phone} helperText={errVend.phone?.message || 'Format: 966XXXXXXXXX (12 digits)'}
                  inputProps={{ maxLength: 12, onKeyDown: numericOnly }}
                  {...regVend('phone', { pattern: { value: PHONE_SA, message: 'Must be 966XXXXXXXXX (12 digits, starts with 966)' } })} />
              </Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Email" error={!!errVend.email} helperText={errVend.email?.message} {...regVend('email', { pattern: { value: PATTERNS.EMAIL, message: MESSAGES.EMAIL } })} /></Grid>
              <Grid item xs={12} sm={6}>
                <TextField fullWidth label="Speciality (e.g. Grills, Mandi)"
                  inputProps={{ onKeyDown: alphaOnly }}
                  error={!!errVend.speciality} helperText={errVend.speciality?.message || 'Alphabets only'}
                  {...regVend('speciality', { pattern: { value: PATTERNS.ALPHA_ONLY, message: 'Letters only — no numbers' } })} />
              </Grid>
              <Grid item xs={12}><TextField fullWidth label="Address" {...regVend('address')} /></Grid>
            </Grid>
          </DialogContent>
          <DialogActions><Button onClick={() => setVendorDialog(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </form>
      </Dialog>

      <Dialog open={mealDialog} onClose={() => setMealDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editMeal ? 'Edit Meal Plan' : 'Add Meal Plan'}</DialogTitle>
        <form onSubmit={hsMeal(onMeal)}>
          <DialogContent dividers>
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField fullWidth label="Meal Plan Name *" {...regMeal('name', { required: true })} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth select label="Meal Type" defaultValue="BREAKFAST" {...regMeal('mealType')}><MenuItem value="BREAKFAST">Breakfast</MenuItem><MenuItem value="LUNCH">Lunch</MenuItem><MenuItem value="DINNER">Dinner</MenuItem></TextField></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Price Per Pax (SAR)" type="number" inputProps={{ min: 0, onKeyDown: decimalOnly }} error={!!errMeal.pricePerPax} helperText={errMeal.pricePerPax?.message} {...regMeal('pricePerPax', { min: { value: 0, message: 'Must be positive' } })} /></Grid>
              <Grid item xs={12}><TextField fullWidth select label="Vendor" {...regMeal('vendorId')}>{vendors.map((v) => <MenuItem key={v.id} value={v.id}>{v.name}</MenuItem>)}</TextField></Grid>
              <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Description" {...regMeal('description')} /></Grid>
            </Grid>
          </DialogContent>
          <DialogActions><Button onClick={() => setMealDialog(false)}>Cancel</Button><Button type="submit" variant="contained">Save</Button></DialogActions>
        </form>
      </Dialog>
    </Box>
  );
}
