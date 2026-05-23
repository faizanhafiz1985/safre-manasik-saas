import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  InputAdornment, Alert,
} from '@mui/material';
import { Email, ArrowBack, CheckCircle } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import api from '../services/api';
import BrandLogo from '../components/BrandLogo';

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async ({ email }) => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setSent(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0D2B1A 0%, #1B4B35 45%, #2E6B4F 100%)',
      p: 2, position: 'relative', overflow: 'hidden',
    }}>
      <Box sx={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', border: '1px solid rgba(201,162,39,0.15)', top: -100, left: -100 }} />
      <Box sx={{ position: 'absolute', width: 300, height: 300, borderRadius: '50%', border: '1px solid rgba(201,162,39,0.1)', bottom: -80, right: -80 }} />

      <Box sx={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          textAlign: 'center', mb: 2.5,
          bgcolor: 'rgba(255,255,255,0.97)', borderRadius: 3,
          py: 2, px: 3, boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        }}>
          <BrandLogo variant="full" maxHeight={110} />
          <Typography variant="caption" sx={{ display: 'block', color: '#1B4B35', mt: 0.5, fontWeight: 600, letterSpacing: 0.5 }}>
            UMRAH · HAJJ · TRAVEL · ZIARAAT · TOURS
          </Typography>
        </Box>

        <Card sx={{ borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <Box sx={{ bgcolor: '#C9A227', py: 1.2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, letterSpacing: 1.5, fontSize: '0.75rem' }}>
              PASSWORD RECOVERY
            </Typography>
          </Box>

          <CardContent sx={{ p: 4 }}>
            {sent ? (
              <Box sx={{ textAlign: 'center' }}>
                <CheckCircle sx={{ fontSize: 56, color: '#2E9E6B', mb: 2 }} />
                <Typography variant="h6" fontWeight={700} color="#1B4B35" gutterBottom>
                  Check Your Email
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  If your email is registered, you'll receive a password reset link shortly.
                  The link expires in <strong>1 hour</strong>.
                </Typography>
                <Typography variant="caption" color="text.secondary" display="block" sx={{ mb: 3 }}>
                  Didn't receive it? Check your spam folder, or try again.
                </Typography>
                <Button
                  fullWidth variant="outlined" component={Link} to="/login"
                  startIcon={<ArrowBack />}
                  sx={{ borderRadius: 2, borderColor: '#1B4B35', color: '#1B4B35', fontWeight: 700 }}
                >
                  Back to Login
                </Button>
              </Box>
            ) : (
              <>
                <Typography variant="h6" fontWeight={700} color="#1B4B35" gutterBottom>
                  Forgot Password?
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Enter your registered email address and we'll send you a link to reset your password.
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <form onSubmit={handleSubmit(onSubmit)}>
                  <TextField
                    fullWidth label="Email Address" type="email" sx={{ mb: 3 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><Email fontSize="small" sx={{ color: '#1B4B35' }} /></InputAdornment>,
                    }}
                    error={!!errors.email} helperText={errors.email?.message}
                    {...register('email', {
                      required: 'Email is required',
                      pattern: { value: /^\S+@\S+$/i, message: 'Invalid email address' },
                    })}
                  />
                  <Button
                    type="submit" fullWidth variant="contained" size="large" disabled={loading}
                    sx={{
                      py: 1.4, fontSize: '1rem', fontWeight: 700, borderRadius: 2, mb: 2,
                      background: 'linear-gradient(135deg, #2E6B4F 0%, #1B4B35 100%)',
                    }}
                  >
                    {loading ? 'Sending…' : 'Send Reset Link'}
                  </Button>
                  <Button
                    fullWidth variant="text" component={Link} to="/login"
                    startIcon={<ArrowBack />}
                    sx={{ color: 'text.secondary', fontWeight: 600 }}
                  >
                    Back to Login
                  </Button>
                </form>
              </>
            )}
          </CardContent>
        </Card>
      </Box>
    </Box>
  );
}
