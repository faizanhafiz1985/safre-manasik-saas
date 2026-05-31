import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Box, Card, CardContent, TextField, Button, Typography, InputAdornment, IconButton, Alert, Divider } from '@mui/material';
import { Email, Lock, Visibility, VisibilityOff } from '@mui/icons-material';
import { useForm } from 'react-hook-form';
import { useAuth } from '../context/AuthContext';
import BrandLogo from '../components/BrandLogo';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();

  const onSubmit = async (data) => {
    setError(''); setLoading(true);
    try {
      const user = await login(data.email, data.password);
      navigate(user.role === 'SUPER_ADMIN' ? '/super-admin' : '/dashboard');
    }
    catch (err) { setError(err.response?.data?.error || 'Invalid credentials. Please try again.'); }
    finally { setLoading(false); }
  };

  return (
    <Box sx={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'linear-gradient(160deg, #0D2B1A 0%, #1B4B35 45%, #2E6B4F 100%)',
      p: 2, position: 'relative', overflow: 'hidden',
    }}>
      <Box sx={{ position:'absolute', width:400, height:400, borderRadius:'50%', border:'1px solid rgba(201,162,39,0.15)', top:-100, left:-100 }} />
      <Box sx={{ position:'absolute', width:300, height:300, borderRadius:'50%', border:'1px solid rgba(201,162,39,0.1)', bottom:-80, right:-80 }} />

      <Box sx={{ width: '100%', maxWidth: 440, position: 'relative', zIndex: 1 }}>
        <Box sx={{
          textAlign: 'center', mb: 2.5,
          bgcolor: 'rgba(255,255,255,0.97)', borderRadius: 3,
          py: 2, px: 3,
          boxShadow: '0 10px 30px rgba(0,0,0,0.25)',
        }}>
          <BrandLogo variant="full" maxHeight={110} />
          <Typography variant="caption" sx={{ display: 'block', color: '#1B4B35', mt: 0.5, fontWeight: 600, letterSpacing: 0.5 }}>
            UMRAH · HAJJ · TRAVEL · ZIARAAT · TOURS
          </Typography>
        </Box>

        <Card sx={{ borderRadius: 3, boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          <Box sx={{ bgcolor: '#C9A227', py: 1.2, textAlign: 'center' }}>
            <Typography variant="subtitle2" sx={{ color: '#fff', fontWeight: 700, letterSpacing: 1.5, fontSize: '0.75rem' }}>
              SECURE LOGIN PORTAL
            </Typography>
          </Box>

          <CardContent sx={{ p: 4 }}>
            <Typography variant="h6" fontWeight={700} color="#1B4B35" gutterBottom>Welcome Back</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Sign in to your SaaS dashboard
            </Typography>

            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            <form onSubmit={handleSubmit(onSubmit)}>
              <TextField fullWidth label="Email Address" type="email" sx={{ mb: 2 }}
                InputProps={{ startAdornment: <InputAdornment position="start"><Email fontSize="small" sx={{ color: '#1B4B35' }} /></InputAdornment> }}
                error={!!errors.email} helperText={errors.email?.message}
                {...register('email', { required: 'Email is required', pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' } })}
              />
              <TextField fullWidth label="Password" type={showPassword ? 'text' : 'password'} sx={{ mb: 1 }}
                InputProps={{
                  startAdornment: <InputAdornment position="start"><Lock fontSize="small" sx={{ color: '#1B4B35' }} /></InputAdornment>,
                  endAdornment: <InputAdornment position="end"><IconButton onClick={() => setShowPassword(!showPassword)} edge="end" size="small">{showPassword ? <VisibilityOff /> : <Visibility />}</IconButton></InputAdornment>,
                }}
                error={!!errors.password} helperText={errors.password?.message}
                {...register('password', { required: 'Password is required' })}
              />
              <Box sx={{ textAlign: 'right', mb: 2.5 }}>
                <Link
                  to="/forgot-password"
                  style={{
                    fontSize: '0.85rem',
                    color: '#C9A227',
                    fontWeight: 700,
                    textDecoration: 'underline',
                    textUnderlineOffset: '2px',
                  }}
                >
                  Forgot password?
                </Link>
              </Box>
              <Button type="submit" fullWidth variant="contained" size="large" disabled={loading}
                sx={{ py: 1.4, fontSize: '1rem', fontWeight: 700, borderRadius: 2,
                  background: 'linear-gradient(135deg, #2E6B4F 0%, #1B4B35 100%)',
                }}>
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <Divider sx={{ my: 3 }}><Typography variant="caption" color="text.secondary">NEW TO SAFRE MANASIK?</Typography></Divider>

            <Box sx={{ textAlign: 'center', mb: 1 }}>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Run an Umrah / Hajj travel agency? Create your own workspace in under 2 minutes —
                no credit card required.
              </Typography>
              <Button
                component={Link}
                to="/signup"
                fullWidth
                variant="outlined"
                size="large"
                sx={{
                  py: 1.3,
                  fontSize: '0.95rem',
                  fontWeight: 700,
                  borderRadius: 2,
                  borderWidth: 2,
                  borderColor: '#C9A227',
                  color: '#1B4B35',
                  '&:hover': {
                    borderWidth: 2,
                    borderColor: '#C9A227',
                    bgcolor: 'rgba(201,162,39,0.08)',
                  },
                }}
              >
                Sign Up Your Agency →
              </Button>
            </Box>
          </CardContent>
        </Card>

        <Typography variant="caption" textAlign="center" display="block" sx={{ mt: 2, color: 'rgba(255,255,255,0.5)' }}>
          By signing up you agree to a free trial of the Starter plan.
        </Typography>
        <Box sx={{ textAlign: 'center', mt: 1.5, display: 'flex', justifyContent: 'center', gap: 2 }}>
          <Link to="/privacy" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>Privacy Policy</Link>
          <Link to="/terms" style={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', textDecoration: 'none' }}>Terms of Service</Link>
        </Box>
      </Box>
    </Box>
  );
}
