import React, { useEffect, useState } from 'react';
import { Box, Typography, Card, CardContent, Grid, TextField, Button, CircularProgress, Alert, Divider } from '@mui/material';
import { Save, Settings } from '@mui/icons-material';
import api from '../services/api';
import { toast } from 'react-toastify';
import { useForm } from 'react-hook-form';
import { PATTERNS, MESSAGES, numericOnly, decimalOnly } from '../utils/validation';

const CONFIG_FIELDS = [
  { key: 'company_name', label: 'Company Name', section: 'Company' },
  { key: 'company_phone', label: 'Phone Number', section: 'Company', phoneField: true },
  { key: 'company_email', label: 'Email Address', section: 'Company', emailField: true },
  { key: 'company_address', label: 'Address', section: 'Company', multiline: true },
  { key: 'currency', label: 'Currency Code (e.g. SAR)', section: 'Financial', currencyField: true },
  { key: 'vat_percentage', label: 'VAT Percentage (%)', section: 'Financial', decimalField: true },
  { key: 'booking_tentative_days', label: 'Tentative Booking Expiry (Days)', section: 'Bookings', integerField: true },
  { key: 'voucher_terms', label: 'Voucher & Invoice Terms and Conditions', section: 'Vouchers', multiline: true, wide: true, rows: 4 },
];

export default function AdminConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  useEffect(() => {
    api.get('/config').then((r) => {
      reset(r.data);
    }).catch((err) => toast.error(err.response?.data?.error || 'Failed to load configuration')).finally(() => setLoading(false));
  }, []);

  const onSubmit = async (data) => {
    setSaving(true);
    try {
      await api.post('/config', { configs: data });
      toast.success('Configuration saved successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Box sx={{ textAlign: 'center', mt: 8 }}><CircularProgress /></Box>;

  const sections = [...new Set(CONFIG_FIELDS.map((f) => f.section))];

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
        <Settings color="primary" />
        <Typography variant="h5">System Configuration</Typography>
      </Box>

      <Alert severity="info" sx={{ mb: 3 }}>Changes here will affect the entire application. Voucher branding, financial settings, and booking rules are controlled from this panel.</Alert>

      <form onSubmit={handleSubmit(onSubmit)}>
        {sections.map((section) => (
          <Card sx={{ mb: 3 }} key={section}>
            <CardContent>
              <Typography variant="subtitle1" fontWeight={700} color="primary.main" gutterBottom>{section} Settings</Typography>
              <Divider sx={{ mb: 2 }} />
              <Grid container spacing={2}>
                {CONFIG_FIELDS.filter((f) => f.section === section).map((field) => (
                  <Grid item xs={12} sm={field.wide ? 12 : 6} key={field.key}>
                    <TextField
                      fullWidth
                      label={field.label}
                      multiline={field.multiline}
                      rows={field.multiline ? (field.rows || 3) : 1}
                      error={!!errors[field.key]}
                      helperText={errors[field.key]?.message}
                      inputProps={{
                        ...(field.phoneField && { onKeyDown: (e) => { if (!/[0-9+\-\s]/.test(e.key) && !['Backspace','Delete','Tab','ArrowLeft','ArrowRight'].includes(e.key)) e.preventDefault(); } }),
                        ...(field.integerField && { onKeyDown: numericOnly }),
                        ...(field.decimalField && { onKeyDown: decimalOnly }),
                        ...(field.currencyField && { maxLength: 3, style: { textTransform: 'uppercase' } }),
                      }}
                      {...register(field.key, {
                        ...(field.emailField && { pattern: { value: PATTERNS.EMAIL, message: MESSAGES.EMAIL } }),
                        ...(field.currencyField && { pattern: { value: PATTERNS.CURRENCY_CODE, message: MESSAGES.CURRENCY_CODE } }),
                        ...(field.phoneField && { pattern: { value: PATTERNS.PHONE, message: MESSAGES.PHONE } }),
                      })}
                    />
                  </Grid>
                ))}
              </Grid>
            </CardContent>
          </Card>
        ))}
        <Button type="submit" variant="contained" size="large" startIcon={<Save />} disabled={saving}>
          {saving ? 'Saving...' : 'Save All Settings'}
        </Button>
      </form>
    </Box>
  );
}
