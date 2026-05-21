import React, { useState } from 'react';
import { Box, Typography, Card, CardContent, Grid, TextField, Button, Avatar, Divider, Alert } from '@mui/material';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import { toast } from 'react-toastify';
import { useForm } from 'react-hook-form';
import { PATTERNS, MESSAGES, alphaOnly } from '../utils/validation';

export default function ProfilePage() {
  const { user, reload } = useAuth();
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState('');
  const { register: regPw, handleSubmit: hsPw, reset: resetPw, watch } = useForm();
  const { register: regProfile, handleSubmit: hsProfile, formState: { errors: profileErrors } } = useForm({ defaultValues: { name: user?.name, phone: user?.phone, companyName: user?.companyName, address: user?.address } });

  const roleColor = { ADMIN: '#7c3aed', AGENT: '#1a56db', CUSTOMER: '#0e9f6e' }[user?.role] || '#64748b';

  const onProfile = async (data) => {
    try {
      await api.put('/auth/profile', data);
      await reload();
      toast.success('Profile updated');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    }
  };

  const onPassword = async (data) => {
    if (data.newPassword !== data.confirmPassword) return setPwError('Passwords do not match');
    setPwError('');
    setPwLoading(true);
    try {
      await api.put('/auth/change-password', { currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Password changed successfully');
      resetPw();
    } catch (err) {
      setPwError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setPwLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 800 }}>
      <Typography variant="h5" gutterBottom>My Profile</Typography>

      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
            <Avatar sx={{ width: 72, height: 72, bgcolor: roleColor, fontSize: 28, fontWeight: 700 }}>{user?.name?.charAt(0)}</Avatar>
            <Box>
              <Typography variant="h6">{user?.name}</Typography>
              <Typography variant="body2" color="text.secondary">{user?.email}</Typography>
              <Typography variant="caption" sx={{ color: roleColor, fontWeight: 700 }}>{user?.role}</Typography>
            </Box>
          </Box>
          <Divider sx={{ mb: 3 }} />
          <form onSubmit={hsProfile(onProfile)}>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Full Name" inputProps={{ onKeyDown: alphaOnly }} error={!!profileErrors.name} helperText={profileErrors.name?.message} {...regProfile('name', { pattern: { value: PATTERNS.ALPHA_ONLY, message: MESSAGES.ALPHA_ONLY } })} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Phone" error={!!profileErrors.phone} helperText={profileErrors.phone?.message} {...regProfile('phone', { pattern: { value: PATTERNS.PHONE, message: MESSAGES.PHONE } })} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Company Name" error={!!profileErrors.companyName} helperText={profileErrors.companyName?.message} {...regProfile('companyName', { pattern: { value: PATTERNS.ALPHANUMERIC, message: MESSAGES.ALPHANUMERIC } })} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Address" {...regProfile('address')} /></Grid>
            </Grid>
            <Button type="submit" variant="contained" sx={{ mt: 2 }}>Save Profile</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={700} gutterBottom>Change Password</Typography>
          <Divider sx={{ mb: 2 }} />
          {pwError && <Alert severity="error" sx={{ mb: 2 }}>{pwError}</Alert>}
          <form onSubmit={hsPw(onPassword)}>
            <Grid container spacing={2}>
              <Grid item xs={12}><TextField fullWidth label="Current Password" type="password" {...regPw('currentPassword', { required: true })} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="New Password" type="password" {...regPw('newPassword', { required: true, minLength: { value: 6, message: 'Min 6 chars' } })} /></Grid>
              <Grid item xs={12} sm={6}><TextField fullWidth label="Confirm New Password" type="password" {...regPw('confirmPassword', { required: true })} /></Grid>
            </Grid>
            <Button type="submit" variant="outlined" sx={{ mt: 2 }} disabled={pwLoading}>{pwLoading ? 'Changing...' : 'Change Password'}</Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}
