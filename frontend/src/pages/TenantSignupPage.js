import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography, Alert, Stepper, Step, StepLabel, Divider,
} from '@mui/material';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import BrandLogo from '../components/BrandLogo';

export default function TenantSignupPage() {
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register: r, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setError(''); setLoading(true);
    try {
      const { data: result } = await api.post('/auth/signup-tenant', data);
      localStorage.setItem('token', result.token);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0D2B1A 0%, #1B4B35 45%, #2E6B4F 100%)', p: 2,
    }}>
      <Box sx={{ width: '100%', maxWidth: 560 }}>
        <Box sx={{ textAlign: 'center', mb: 2.5, bgcolor: 'rgba(255,255,255,0.97)', borderRadius: 3, py: 2, px: 3, boxShadow: '0 10px 30px rgba(0,0,0,0.25)' }}>
          <BrandLogo variant="full" maxHeight={100} />
        </Box>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <Typography variant="h5" fontWeight={700} color="#fff">Start your free trial</Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.7)' }}>Starter plan • no credit card required</Typography>
        </Box>

        <Card sx={{ borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <Box sx={{ bgcolor: '#C9A227', py: 1.2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, letterSpacing: 1.5 }}>NEW TENANT SIGNUP</Typography>
          </Box>
          <CardContent sx={{ p: 4 }}>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
            <form onSubmit={handleSubmit(onSubmit)}>
              <Typography variant="subtitle1" fontWeight={700} color="#1B4B35" sx={{ mb: 1 }}>Your Organisation</Typography>
              <TextField fullWidth label="Organisation Name *" sx={{ mb: 2 }}
                error={!!errors.tenantName} helperText={errors.tenantName?.message}
                {...r('tenantName', { required: 'Required' })} />
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField fullWidth label="Contact Phone" {...r('contactPhone')} />
                <TextField fullWidth label="City" {...r('city')} />
              </Box>
              <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
                <TextField fullWidth label="CR Number (10 digits)" {...r('crNumber')} />
                <TextField fullWidth label="VAT Number (15 digits)" {...r('vatNumber')} />
              </Box>
              <TextField fullWidth label="Umrah License Number" sx={{ mb: 3 }} {...r('umrahLicenseNumber')} />

              <Divider sx={{ my: 2 }} />
              <Typography variant="subtitle1" fontWeight={700} color="#1B4B35" sx={{ mb: 1 }}>Admin Account</Typography>
              <TextField fullWidth label="Your Name *" sx={{ mb: 2 }}
                error={!!errors.adminName} helperText={errors.adminName?.message}
                {...r('adminName', { required: 'Required' })} />
              <TextField fullWidth label="Email *" type="email" sx={{ mb: 2 }}
                error={!!errors.adminEmail} helperText={errors.adminEmail?.message}
                {...r('adminEmail', { required: 'Required', pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' } })} />
              <TextField fullWidth label="Password (min 8 chars) *" type="password" sx={{ mb: 3 }}
                error={!!errors.adminPassword} helperText={errors.adminPassword?.message}
                {...r('adminPassword', { required: 'Required', minLength: { value: 8, message: 'Min 8 characters' } })} />

              <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}
                sx={{ py: 1.4, background: 'linear-gradient(135deg, #2E6B4F 0%, #1B4B35 100%)' }}>
                {loading ? 'Creating your account...' : 'Create Account & Start Trial'}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Typography variant="body2" textAlign="center" sx={{ mt: 2, color: 'rgba(255,255,255,0.6)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: '#C9A227', fontWeight: 600, textDecoration: 'none' }}>Sign in</Link>
        </Typography>
      </Box>
    </Box>
  );
}
