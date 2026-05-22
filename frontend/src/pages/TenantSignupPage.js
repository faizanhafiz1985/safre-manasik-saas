import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, Divider,
  Autocomplete, InputAdornment,
} from '@mui/material';
import { useForm, Controller } from 'react-hook-form';
import api from '../services/api';
import BrandLogo from '../components/BrandLogo';
import COUNTRIES from '../data/countries';

/*
  Validation rules enforced here (all client-side; backend also has its own
  guards in authController.signupTenant for the required fields).

    organisationName : required, 2–80 chars
    country          : required, must be one of the catalogue countries
    city             : required, must belong to the selected country
    contactPhone     : digits only after optional leading '+', 11–16 digits
                       (covers all real-world E.164 numbers; min 12 incl.
                       country code as the user requested while leaving room
                       for a few markets that have 11-digit numbers like KW)
    crNumber         : exactly 10 digits (Saudi Commercial Registration)
    vatNumber        : exactly 15 digits (Saudi VAT number)
    umrahLicense     : optional free text
    adminName        : required
    adminEmail       : valid email
    adminPassword    : ≥ 8 chars, must contain at least one letter + one digit
*/
export default function TenantSignupPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(null); // {email, message} after successful submit
  const {
    register: r,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors },
  } = useForm({
    defaultValues: {
      tenantName: '',
      country: null,         // { code, name, dialCode, cities }
      city: '',
      contactPhone: '',
      crNumber: '',
      vatNumber: '',
      umrahLicenseNumber: '',
      adminName: '',
      adminEmail: '',
      adminPassword: '',
    },
  });

  const selectedCountry = watch('country');

  // Cities to show in the city dropdown — driven by the currently picked country.
  // When the country changes, the cached list updates and the city is reset.
  const cityOptions = useMemo(
    () => (selectedCountry ? selectedCountry.cities : []),
    [selectedCountry]
  );

  const onSubmit = async (data) => {
    setError('');
    setLoading(true);
    try {
      // Flatten the country object into the simple string the backend expects.
      const payload = {
        tenantName: data.tenantName.trim(),
        contactPhone: data.contactPhone.trim(),
        country: data.country?.name || '',
        city: data.city,
        crNumber: data.crNumber,
        vatNumber: data.vatNumber,
        umrahLicenseNumber: data.umrahLicenseNumber,
        adminName: data.adminName.trim(),
        adminEmail: data.adminEmail.trim().toLowerCase(),
        adminPassword: data.adminPassword,
      };
      const { data: result } = await api.post('/auth/signup-tenant', payload);
      // New flow: application goes to SUPER_ADMIN for review. We do NOT
      // auto-login. Show a friendly confirmation instead.
      setSubmitted({
        email: data.adminEmail,
        message: result.message || 'Your application is under review.',
      });
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed. Please review the fields and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Phone validation: optional leading '+', 11–16 digits total.
  const validatePhone = (value) => {
    if (!value) return 'Contact phone is required';
    const cleaned = value.replace(/[\s\-()]/g, '');
    if (!/^\+?\d{11,16}$/.test(cleaned)) {
      return 'Enter a valid international phone number with country code (12+ digits, e.g. +966501234567)';
    }
    return true;
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(160deg, #0D2B1A 0%, #1B4B35 45%, #2E6B4F 100%)',
        p: 2,
      }}
    >
      <Box sx={{ width: '100%', maxWidth: 620 }}>
        <Box sx={{ textAlign: 'center', mb: 2.5, bgcolor: 'rgba(255,255,255,0.97)', borderRadius: 3, py: 2, px: 3, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
          <BrandLogo variant="full" maxHeight={100} />
        </Box>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight={700} color="#fff">Start your free trial</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>
            Starter plan • no credit card required
          </Typography>
        </Box>

        <Card sx={{ borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <Box sx={{ bgcolor: '#C9A227', py: 1.2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, letterSpacing: 1.5 }}>
              NEW TENANT SIGNUP
            </Typography>
          </Box>
          <CardContent sx={{ p: 4 }}>
            {submitted ? (
              <Box sx={{ textAlign: 'center', py: 3 }}>
                <Box sx={{
                  display: 'inline-flex', width: 64, height: 64, borderRadius: '50%',
                  bgcolor: '#E8F5EE', color: '#2E9E6B', alignItems: 'center', justifyContent: 'center',
                  fontSize: 36, mb: 2,
                }}>✓</Box>
                <Typography variant="h6" fontWeight={700} color="#1B4B35" sx={{ mb: 1 }}>
                  Application submitted!
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  {submitted.message}
                </Typography>
                <Alert severity="info" sx={{ textAlign: 'left' }}>
                  We've sent a confirmation to <strong>{submitted.email}</strong>. Once approved,
                  you'll get a second email with a link to log in. If you don't see anything within
                  24 hours, please check your spam folder or reply to that email.
                </Alert>
                <Link to="/login" style={{ color: '#C9A227', fontWeight: 600, textDecoration: 'none', display: 'inline-block', marginTop: 16 }}>
                  ← Back to sign in
                </Link>
              </Box>
            ) : (
              <>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <Typography variant="subtitle1" fontWeight={700} color="#1B4B35" sx={{ mb: 1 }}>
                Your Organisation
              </Typography>

              <TextField
                fullWidth
                label="Organisation Name *"
                sx={{ mb: 2 }}
                error={!!errors.tenantName}
                helperText={errors.tenantName?.message}
                {...r('tenantName', {
                  required: 'Organisation name is required',
                  minLength: { value: 2, message: 'At least 2 characters' },
                  maxLength: { value: 80, message: 'Maximum 80 characters' },
                })}
              />

              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <Controller
                  name="country"
                  control={control}
                  rules={{ required: 'Country is required' }}
                  render={({ field }) => (
                    <Autocomplete
                      fullWidth
                      options={COUNTRIES}
                      getOptionLabel={(o) => o?.name || ''}
                      isOptionEqualToValue={(a, b) => a?.code === b?.code}
                      value={field.value}
                      onChange={(_, val) => {
                        field.onChange(val);
                        // Reset city when country changes so the old selection
                        // doesn't linger.
                        setValue('city', '');
                      }}
                      renderOption={(props, option) => (
                        <li {...props} key={option.code}>
                          <Box component="span" sx={{ mr: 1, fontWeight: 700, color: '#1B4B35' }}>
                            +{option.dialCode}
                          </Box>
                          {option.name}
                        </li>
                      )}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Country *"
                          error={!!errors.country}
                          helperText={errors.country?.message}
                        />
                      )}
                    />
                  )}
                />

                <Controller
                  name="city"
                  control={control}
                  rules={{ required: 'City is required' }}
                  render={({ field }) => (
                    <Autocomplete
                      fullWidth
                      options={cityOptions}
                      value={field.value || null}
                      onChange={(_, val) => field.onChange(val || '')}
                      disabled={!selectedCountry}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label={selectedCountry ? 'City *' : 'City * (pick a country first)'}
                          error={!!errors.city}
                          helperText={errors.city?.message || (selectedCountry ? '' : 'Country selection enables this list')}
                        />
                      )}
                    />
                  )}
                />
              </Box>

              <TextField
                fullWidth
                label="Contact Phone *"
                sx={{ mb: 2 }}
                placeholder={selectedCountry ? `+${selectedCountry.dialCode} XXXXXXXXX` : '+966XXXXXXXXX'}
                InputProps={{
                  startAdornment: selectedCountry && (
                    <InputAdornment position="start">+{selectedCountry.dialCode}</InputAdornment>
                  ),
                }}
                error={!!errors.contactPhone}
                helperText={errors.contactPhone?.message || 'Include your country code, e.g. +966501234567 (12+ digits total)'}
                {...r('contactPhone', { validate: validatePhone })}
              />

              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField
                  fullWidth
                  label="CR Number (10 digits)"
                  inputProps={{ inputMode: 'numeric', maxLength: 10 }}
                  error={!!errors.crNumber}
                  helperText={errors.crNumber?.message || 'Saudi Commercial Registration number — digits only'}
                  {...r('crNumber', {
                    pattern: { value: /^\d{10}$/, message: 'Must be exactly 10 digits' },
                  })}
                  onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); }}
                />
                <TextField
                  fullWidth
                  label="VAT Number (15 digits)"
                  inputProps={{ inputMode: 'numeric', maxLength: 15 }}
                  error={!!errors.vatNumber}
                  helperText={errors.vatNumber?.message || 'Saudi VAT registration — digits only'}
                  {...r('vatNumber', {
                    pattern: { value: /^\d{15}$/, message: 'Must be exactly 15 digits' },
                  })}
                  onInput={(e) => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 15); }}
                />
              </Box>

              <TextField
                fullWidth
                label="Umrah License Number"
                sx={{ mb: 3 }}
                {...r('umrahLicenseNumber')}
              />

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" fontWeight={700} color="#1B4B35" sx={{ mb: 1 }}>
                Admin Account
              </Typography>

              <TextField
                fullWidth
                label="Your Name *"
                sx={{ mb: 2 }}
                error={!!errors.adminName}
                helperText={errors.adminName?.message}
                {...r('adminName', {
                  required: 'Your name is required',
                  minLength: { value: 2, message: 'At least 2 characters' },
                })}
              />

              <TextField
                fullWidth
                label="Email *"
                type="email"
                sx={{ mb: 2 }}
                error={!!errors.adminEmail}
                helperText={errors.adminEmail?.message}
                {...r('adminEmail', {
                  required: 'Email is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address',
                  },
                })}
              />

              <TextField
                fullWidth
                label="Password (min 8 chars, letters + digits) *"
                type="password"
                sx={{ mb: 3 }}
                error={!!errors.adminPassword}
                helperText={errors.adminPassword?.message || 'Use at least 8 characters with letters and numbers'}
                {...r('adminPassword', {
                  required: 'Password is required',
                  minLength: { value: 8, message: 'Minimum 8 characters' },
                  validate: (v) =>
                    (/[A-Za-z]/.test(v) && /\d/.test(v)) ||
                    'Password must contain at least one letter and one digit',
                })}
              />

              <Button
                type="submit"
                fullWidth
                variant="contained"
                size="large"
                disabled={loading}
                sx={{
                  py: 1.4,
                  fontWeight: 700,
                  fontSize: '1rem',
                  background: 'linear-gradient(135deg, #2E6B4F 0%, #1B4B35 100%)',
                  '&:hover': { background: 'linear-gradient(135deg, #1B4B35 0%, #0D2B1A 100%)' },
                }}
              >
                {loading ? 'Creating your account…' : 'Create Account & Start Trial'}
              </Button>
            </form>
              </>
            )}
          </CardContent>
        </Card>

        <Typography variant="body2" textAlign="center" sx={{ mt: 2, color: 'rgba(255,255,255,0.6)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#C9A227', fontWeight: 600, textDecoration: 'none' }}>
            Sign in
          </Link>
        </Typography>
      </Box>
    </Box>
  );
}
