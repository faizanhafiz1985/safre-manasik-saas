import React, { useEffect, useState } from 'react';
import {
  Box, Paper, Typography, TextField, Button, Stack, Grid, Chip,
  Card, CardContent, Divider, FormControl, InputLabel, Select, MenuItem,
  Switch, FormControlLabel, Alert, Link, Autocomplete, InputAdornment,
} from '@mui/material';
import { Business, Save, Payment, OpenInNew } from '@mui/icons-material';
import { toast } from 'react-toastify';
import api from '../services/api';
import COUNTRIES, { getCountryByName } from '../data/countries';

export default function TenantSettingsPage() {
  const [tenant, setTenant] = useState(null);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  const load = async () => {
    const { data } = await api.get('/tenant/current');
    setTenant(data);
    setForm({
      name: data.name || '',
      contactEmail: data.contactEmail || '',
      contactPhone: data.contactPhone || '',
      crNumber: data.crNumber || '',
      vatNumber: data.vatNumber || '',
      umrahLicenseNumber: data.umrahLicenseNumber || '',
      address: data.address || '',
      country: getCountryByName(data.country) || null,
      city: data.city || '',
      currency: data.currency || 'SAR',
      language: data.language || 'en',
      timezone: data.timezone || 'Asia/Riyadh',
      primaryColor: data.primaryColor || '#0D7377',
      logoUrl: data.logoUrl || '',
      paypalEnabled: !!data.paypalEnabled,
      paypalMode: data.paypalMode || 'sandbox',
      paypalClientId: data.paypalClientId || '',
      // Secret comes back masked (e.g. "••••••••abcd"). Keep the mask in the
      // input — backend treats values containing • as "no change" on save.
      paypalSecret: data.paypalSecret || '',
    });
  };

  useEffect(() => { load(); }, []);

  // Client-side validation mirrors the signup form so existing tenants get the
  // same guarantees if they edit these fields later.
  const validate = () => {
    if (form.contactPhone) {
      const cleaned = form.contactPhone.replace(/[\s\-()]/g, '');
      if (!/^\+?\d{11,16}$/.test(cleaned)) {
        toast.error('Contact phone must be a valid international number (12+ digits incl. country code, e.g. +966501234567)');
        return false;
      }
    }
    if (form.crNumber && !/^\d{10}$/.test(form.crNumber)) {
      toast.error('CR Number must be exactly 10 digits');
      return false;
    }
    if (form.vatNumber && !/^\d{15}$/.test(form.vatNumber)) {
      toast.error('VAT Number must be exactly 15 digits');
      return false;
    }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    setSaving(true);
    try {
      // Flatten country object → name string for the backend.
      const payload = { ...form, country: form.country?.name || '' };
      await api.put('/tenant/current', payload);
      toast.success('Settings saved');
      load();
    } finally {
      setSaving(false);
    }
  };

  if (!tenant) return <Box sx={{ p: 4 }}>Loading...</Box>;

  const statusColor = tenant.status === 'ACTIVE' ? 'success' : tenant.status === 'TRIAL' ? 'warning' : 'error';
  const planColor   = tenant.plan === 'ENTERPRISE' ? 'secondary' : tenant.plan === 'GROWTH' ? 'primary' : 'info';

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" fontWeight={700} color="#1B4B35">Tenant Settings</Typography>
        <Typography variant="body2" color="text.secondary">
          Configure your organisation, compliance, branding, and billing details.
        </Typography>
      </Box>

      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Card><CardContent>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Business sx={{ color: '#1B4B35' }} />
              <Box>
                <Typography variant="caption" color="text.secondary">Organisation</Typography>
                <Typography fontWeight={700}>{tenant.name}</Typography>
                <Typography variant="caption" color="text.secondary"><code>{tenant.slug}.safremanasik.com</code></Typography>
              </Box>
            </Stack>
          </CardContent></Card>
        </Grid>
        <Grid item xs={6} md={2}><Card><CardContent>
          <Typography variant="caption" color="text.secondary">Plan</Typography>
          <Box sx={{ mt: 0.5 }}><Chip label={tenant.plan} color={planColor} /></Box>
        </CardContent></Card></Grid>
        <Grid item xs={6} md={2}><Card><CardContent>
          <Typography variant="caption" color="text.secondary">Status</Typography>
          <Box sx={{ mt: 0.5 }}><Chip label={tenant.status} color={statusColor} /></Box>
        </CardContent></Card></Grid>
        <Grid item xs={6} md={2}><Card><CardContent>
          <Typography variant="caption" color="text.secondary">Users</Typography>
          <Typography variant="h6" fontWeight={700}>{tenant._count.users} / {tenant.maxUsers}</Typography>
        </CardContent></Card></Grid>
        <Grid item xs={6} md={2}><Card><CardContent>
          <Typography variant="caption" color="text.secondary">Bookings</Typography>
          <Typography variant="h6" fontWeight={700}>{tenant._count.bookings} / {tenant.maxBookings}</Typography>
        </CardContent></Card></Grid>
      </Grid>

      <Paper sx={{ p: 3 }}>
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Organisation Information</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Organisation Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Contact Email" value={form.contactEmail} onChange={(e) => setForm({ ...form, contactEmail: e.target.value })} />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              label="Contact Phone"
              value={form.contactPhone}
              onChange={(e) => setForm({ ...form, contactPhone: e.target.value })}
              placeholder={form.country ? `+${form.country.dialCode} XXXXXXXXX` : '+966XXXXXXXXX'}
              InputProps={{
                startAdornment: form.country && (
                  <InputAdornment position="start">+{form.country.dialCode}</InputAdornment>
                ),
              }}
              helperText="Include country code, 12+ digits"
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Autocomplete
              fullWidth
              options={COUNTRIES}
              getOptionLabel={(o) => o?.name || ''}
              isOptionEqualToValue={(a, b) => a?.code === b?.code}
              value={form.country}
              onChange={(_, val) => setForm({ ...form, country: val, city: '' })}
              renderOption={(props, option) => (
                <li {...props} key={option.code}>
                  <Box component="span" sx={{ mr: 1, fontWeight: 700, color: '#1B4B35' }}>
                    +{option.dialCode}
                  </Box>
                  {option.name}
                </li>
              )}
              renderInput={(params) => <TextField {...params} label="Country" />}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <Autocomplete
              fullWidth
              freeSolo
              options={form.country?.cities || []}
              value={form.city || null}
              onChange={(_, val) => setForm({ ...form, city: val || '' })}
              onInputChange={(_, val) => setForm({ ...form, city: val })}
              disabled={!form.country}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={form.country ? 'City' : 'City (pick a country first)'}
                  helperText={form.country ? 'Pick from list or type a custom city' : 'Country selection enables the city list'}
                />
              )}
            />
          </Grid>
          <Grid item xs={12} md={6}>
            <TextField fullWidth label="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Saudi Compliance</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="CR Number (10 digits)"
              value={form.crNumber}
              onChange={(e) => setForm({ ...form, crNumber: e.target.value.replace(/\D/g, '').slice(0, 10) })}
              inputProps={{ inputMode: 'numeric', maxLength: 10 }}
              helperText="Digits only — Saudi Commercial Registration"
              error={!!form.crNumber && !/^\d{10}$/.test(form.crNumber)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              label="VAT Number (15 digits)"
              value={form.vatNumber}
              onChange={(e) => setForm({ ...form, vatNumber: e.target.value.replace(/\D/g, '').slice(0, 15) })}
              inputProps={{ inputMode: 'numeric', maxLength: 15 }}
              helperText="Digits only — Saudi VAT registration"
              error={!!form.vatNumber && !/^\d{15}$/.test(form.vatNumber)}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField fullWidth label="Umrah License Number" value={form.umrahLicenseNumber} onChange={(e) => setForm({ ...form, umrahLicenseNumber: e.target.value })} />
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />
        <Typography variant="h6" fontWeight={700} sx={{ mb: 2 }}>Localisation & Branding</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Currency</InputLabel>
              <Select value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} label="Currency">
                <MenuItem value="SAR">SAR — Saudi Riyal</MenuItem>
                <MenuItem value="USD">USD — US Dollar</MenuItem>
                <MenuItem value="EUR">EUR — Euro</MenuItem>
                <MenuItem value="GBP">GBP — British Pound</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <FormControl fullWidth>
              <InputLabel>Language</InputLabel>
              <Select value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} label="Language">
                <MenuItem value="en">English</MenuItem>
                <MenuItem value="ar">العربية (Arabic)</MenuItem>
                <MenuItem value="ur">اردو (Urdu)</MenuItem>
                <MenuItem value="id">Bahasa Indonesia</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth label="Timezone" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
          </Grid>
          <Grid item xs={12} md={3}>
            <TextField fullWidth label="Primary Colour" type="color" value={form.primaryColor} onChange={(e) => setForm({ ...form, primaryColor: e.target.value })} InputLabelProps={{ shrink: true }} />
          </Grid>
          <Grid item xs={12} md={8}>
            <TextField
              fullWidth
              label="Logo URL"
              value={form.logoUrl}
              onChange={(e) => setForm({ ...form, logoUrl: e.target.value })}
              placeholder="https://example.com/your-logo.png"
              helperText="Paste a public HTTPS image URL (PNG/SVG/JPG). Once saved, your logo will replace 'Safre Manasik' across the app for users in your tenant. Leave blank to use the default platform logo."
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', p: 2, bgcolor: '#F3F8F5', borderRadius: 2, border: '1px dashed #C9A227' }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1 }}>Live preview</Typography>
              {form.logoUrl ? (
                <img
                  src={form.logoUrl}
                  alt="Your logo"
                  style={{ maxHeight: 80, maxWidth: '100%', objectFit: 'contain' }}
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextElementSibling.style.display = 'block'; }}
                />
              ) : null}
              <Typography variant="caption" color="error" sx={{ display: form.logoUrl ? 'none' : 'block' }}>
                {form.logoUrl ? 'Image failed to load' : 'No logo URL set (platform default will be used)'}
              </Typography>
            </Box>
          </Grid>
        </Grid>

        <Divider sx={{ my: 3 }} />
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
          <Payment sx={{ color: '#1B4B35' }} />
          <Typography variant="h6" fontWeight={700}>Payment Gateway (PayPal)</Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Connect your own PayPal merchant account to accept online payments from your customers.
          Funds go directly to your PayPal account — the platform doesn&apos;t handle the money.
          {' '}
          <Link href="https://developer.paypal.com/dashboard/applications/live" target="_blank" rel="noopener" sx={{ display: 'inline-flex', alignItems: 'center' }}>
            Get your API keys <OpenInNew sx={{ fontSize: 14, ml: 0.3 }} />
          </Link>
        </Typography>

        {!form.paypalEnabled && (
          <Alert severity="info" sx={{ mb: 2 }}>
            PayPal is disabled. Bookings will use the platform&apos;s fallback (stub) gateway, which doesn&apos;t move real money.
            Enable it and provide your live keys to accept actual payments.
          </Alert>
        )}

        <Grid container spacing={2}>
          <Grid item xs={12} md={4}>
            <FormControlLabel
              control={
                <Switch
                  checked={!!form.paypalEnabled}
                  onChange={(e) => setForm({ ...form, paypalEnabled: e.target.checked })}
                />
              }
              label={form.paypalEnabled ? 'PayPal enabled' : 'PayPal disabled'}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <FormControl fullWidth disabled={!form.paypalEnabled}>
              <InputLabel>Mode</InputLabel>
              <Select
                value={form.paypalMode}
                onChange={(e) => setForm({ ...form, paypalMode: e.target.value })}
                label="Mode"
              >
                <MenuItem value="sandbox">Sandbox (testing)</MenuItem>
                <MenuItem value="live">Live (real payments)</MenuItem>
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              label="PayPal Client ID"
              value={form.paypalClientId}
              onChange={(e) => setForm({ ...form, paypalClientId: e.target.value })}
              disabled={!form.paypalEnabled}
              placeholder="AY-…"
              helperText="From your PayPal Developer Dashboard → App → API credentials"
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              fullWidth
              type="password"
              label="PayPal Secret"
              value={form.paypalSecret}
              onChange={(e) => setForm({ ...form, paypalSecret: e.target.value })}
              disabled={!form.paypalEnabled}
              placeholder="••••"
              helperText="Stored encrypted on the server. Leave the masked value unchanged to keep the existing secret."
            />
          </Grid>
        </Grid>

        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'flex-end' }}>
          <Button variant="contained" startIcon={<Save />} onClick={save} disabled={saving} size="large">
            {saving ? 'Saving...' : 'Save Settings'}
          </Button>
        </Box>
      </Paper>
    </Box>
  );
}
