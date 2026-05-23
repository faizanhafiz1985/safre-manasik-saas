import React, { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  InputAdornment, IconButton, Alert,
} from '@mui/material';
import { Lock, Visibility, VisibilityOff, CheckCircle } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import api from '../services/api';
import BrandLogo from '../components/BrandLogo';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const newPassword = watch('newPassword');

  const onSubmit = async ({ newPassword: pwd }) => {
    setError(''); setLoading(true);
    try {
      await api.post('/auth/reset-password', { token, newPassword: pwd });
      setDone(true);
      setTimeout(() => navigate('/login'), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(160deg, #0D2B1A 0%, #1B4B35 45%, #2E6B4F 100%)', p: 2 }}>
        <Alert severity="error" sx={{ maxWidth: 440 }}>
          Invalid reset link. Please request a new one from the{' '}
          <Link to="/forgot-password" style={{ color: '#C0392B', fontWeight: 700 }}>forgot password</Link> page.
        </Alert>
      </Box>
    );
  }

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
              SET NEW PASSWORD
            </Typography>
          </Box>

          <CardContent sx={{ p: 4 }}>
            {done ? (
              <Box sx={{ textAlign: 'center' }}>
                <CheckCircle sx={{ fontSize: 56, color: '#2E9E6B', mb: 2 }} />
                <Typography variant="h6" fontWeight={700} color="#1B4B35" gutterBottom>
                  Password Reset!
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Your password has been changed. Redirecting you to login…
                </Typography>
              </Box>
            ) : (
              <>
                <Typography variant="h6" fontWeight={700} color="#1B4B35" gutterBottom>
                  Set New Password
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  Choose a new password for your account. Minimum 6 characters.
                </Typography>

                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

                <form onSubmit={handleSubmit(onSubmit)}>
                  <TextField
                    fullWidth label="New Password" type={showNew ? 'text' : 'password'} sx={{ mb: 2 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><Lock fontSize="small" sx={{ color: '#1B4B35' }} /></InputAdornment>,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowNew(!showNew)} edge="end" size="small">
                            {showNew ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    error={!!errors.newPassword} helperText={errors.newPassword?.message}
                    {...register('newPassword', {
                      required: 'New password is required',
                      minLength: { value: 6, message: 'Minimum 6 characters' },
                    })}
                  />
                  <TextField
                    fullWidth label="Confirm New Password" type={showConfirm ? 'text' : 'password'} sx={{ mb: 3 }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><Lock fontSize="small" sx={{ color: '#1B4B35' }} /></InputAdornment>,
                      endAdornment: (
                        <InputAdornment position="end">
                          <IconButton onClick={() => setShowConfirm(!showConfirm)} edge="end" size="small">
                            {showConfirm ? <VisibilityOff /> : <Visibility />}
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                    error={!!errors.confirmPassword} helperText={errors.confirmPassword?.message}
                    {...register('confirmPassword', {
                      required: 'Please confirm your password',
                      validate: (v) => v === newPassword || 'Passwords do not match',
                    })}
                  />
                  <Button
                    type="submit" fullWidth variant="contained" size="large" disabled={loading}
                    sx={{
                      py: 1.4, fontSize: '1rem', fontWeight: 700, borderRadius: 2,
                      background: 'linear-gradient(135deg, #2E6B4F 0%, #1B4B35 100%)',
                    }}
                  >
                    {loading ? 'Saving…' : 'Reset Password'}
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
