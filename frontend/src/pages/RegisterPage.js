import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Box, Card, CardContent, TextField, Button, Typography, Alert, MenuItem, Grid, InputAdornment, Divider } from '@mui/material';
import { Person, Email, Lock, Phone, Business } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import { PATTERNS, MESSAGES, alphaOnly } from '../utils/validation';

export default function RegisterPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, watch, formState: { errors } } = useForm({ defaultValues: { role: 'CUSTOMER' } });

  const onSubmit = async (data) => {
    if (data.password !== data.confirmPassword) return setError('Passwords do not match');
    setError('');
    setLoading(true);
    try {
      const api = (await import('../services/api')).default;
      await api.post('/auth/register', { name: data.name, email: data.email, password: data.password, role: data.role, phone: data.phone, companyName: data.companyName });
      await login(data.email, data.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const role = watch('role');

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0D2B1A 0%, #1B4B35 45%, #2E6B4F 100%)',
      p: 2, position: 'relative', overflow: 'hidden',
    }}>
      {/* Decorative circles */}
      <Box sx={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', border: '1px solid rgba(201,162,39,0.15)', top: -100, right: -100 }} />
      <Box sx={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(201,162,39,0.1)', bottom: -80, left: -80 }} />

      <Box sx={{ width: '100%', maxWidth: 540, position: 'relative', zIndex: 1 }}>
        {/* Logo */}
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Box sx={{ display: 'inline-block', bgcolor: 'rgba(255,255,255,0.95)', borderRadius: 3, px: 3, py: 2, mb: 2, boxShadow: '0 8px 32px rgba(0,0,0,0.3)' }}>
            <img src="/logo.svg" alt="Safr e Manasik" style={{ height: 70, display: 'block' }} />
          </Box>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.8rem' }}>
            Travel Management System
          </Typography>
        </Box>

        <Card sx={{ borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.4)', overflow: 'hidden' }}>
          <Box sx={{ bgcolor: '#C9A227', py: 1.2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, letterSpacing: 1.5, fontSize: '0.75rem', textTransform: 'uppercase' }}>
              Create New Account
            </Typography>
          </Box>

          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" fontWeight={700} color="#1B4B35" gutterBottom>Register</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Join Safre Manasik to manage your Umrah journey
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <form onSubmit={handleSubmit(onSubmit)}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField fullWidth label="Full Name"
                    InputProps={{ startAdornment: <InputAdornment position="start"><Person fontSize="small" sx={{ color: '#1B4B35' }} /></InputAdornment> }}
                    inputProps={{ onKeyDown: alphaOnly }}
                    error={!!errors.name} helperText={errors.name?.message}
                    {...register('name', { required: 'Name is required', pattern: { value: PATTERNS.ALPHA_ONLY, message: MESSAGES.ALPHA_ONLY } })}
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField fullWidth label="Email Address" type="email"
                    InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" sx={{ color: '#1B4B35' }} /></InputAdornment> }}
                    error={!!errors.email} helperText={errors.email?.message}
                    {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' } })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Phone Number"
                    InputProps={{ startAdornment: <InputAdornment position="start"><Phone fontSize="small" sx={{ color: '#1B4B35' }} /></InputAdornment> }}
                    error={!!errors.phone} helperText={errors.phone?.message}
                    {...register('phone', { pattern: { value: PATTERNS.PHONE, message: MESSAGES.PHONE } })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth select label="Account Type" defaultValue="CUSTOMER" {...register('role')}>
                    <MenuItem value="CUSTOMER">Pilgrim / Customer</MenuItem>
                    <MenuItem value="AGENT">Travel Agent</MenuItem>
                  </TextField>
                </Grid>
                {role === 'AGENT' && (
                  <Grid item xs={12}>
                    <TextField fullWidth label="Company Name"
                      InputProps={{ startAdornment: <InputAdornment position="start"><Business fontSize="small" sx={{ color: '#1B4B35' }} /></InputAdornment> }}
                      error={!!errors.companyName} helperText={errors.companyName?.message}
                      {...register('companyName', { pattern: { value: PATTERNS.ALPHANUMERIC, message: MESSAGES.ALPHANUMERIC } })}
                    />
                  </Grid>
                )}
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Password" type="password"
                    InputProps={{ startAdornment: <InputAdornment position="start"><Lock fontSize="small" sx={{ color: '#1B4B35' }} /></InputAdornment> }}
                    error={!!errors.password} helperText={errors.password?.message}
                    {...register('password', { required: 'Password required', minLength: { value: 6, message: 'Min 6 characters' } })}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField fullWidth label="Confirm Password" type="password"
                    InputProps={{ startAdornment: <InputAdornment position="start"><Lock fontSize="small" sx={{ color: '#1B4B35' }} /></InputAdornment> }}
                    {...register('confirmPassword', { required: 'Please confirm password' })}
                  />
                </Grid>
              </Grid>

              <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}
                sx={{ mt: 3, py: 1.4, fontSize: '1rem', fontWeight: 700, borderRadius: 2,
                  background: 'linear-gradient(135deg, #2E6B4F 0%, #1B4B35 100%)',
                  boxShadow: '0 4px 15px rgba(27,75,53,0.4)',
                }}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Typography variant="body2" textAlign="center" sx={{ mt: 2, color: 'rgba(255,255,255,0.5)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#C9A227', fontWeight: 600, textDecoration: 'none' }}>Sign in here</Link>
        </Typography>
      </Box>
    </Box>
  );
}
