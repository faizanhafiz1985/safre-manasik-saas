import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Box, Drawer, AppBar, Toolbar, IconButton, Typography, Avatar, Menu, MenuItem, useMediaQuery, useTheme, Divider, Chip } from '@mui/material';
import { Menu as MenuIcon, Logout, Settings, Person } from '@mui/icons-material';
import { useAuth } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import Sidebar from './Sidebar';

const DRAWER_WIDTH = 260;

export default function Layout() {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [anchorEl, setAnchorEl] = useState(null);
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); toast.info('Logged out'); navigate('/login'); };

  const roleColor = { ADMIN: '#C9A227', AGENT: '#4A90D9', CUSTOMER: '#2E9E6B' }[user?.role] || '#64748b';
  const roleLabel = { ADMIN: 'Administrator', AGENT: 'Travel Agent', CUSTOMER: 'Pilgrim' }[user?.role];

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: '#F7F2E8' }}>
      <AppBar position="fixed" elevation={0} sx={{
        zIndex: theme.zIndex.drawer + 1,
        bgcolor: '#fff',
        borderBottom: '1px solid rgba(27,75,53,0.12)',
        boxShadow: '0 2px 8px rgba(27,75,53,0.08)',
      }}>
        <Toolbar sx={{ gap: 1 }}>
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileOpen(!mobileOpen)} sx={{ color: '#1B4B35' }}>
              <MenuIcon />
            </IconButton>
          )}

          {/* Logo in topbar (mobile) / breadcrumb title (desktop) */}
          <Box sx={{ display: { xs: 'block', md: 'none' } }}>
            <img src="/logo.svg" alt="Safr e Manasik" style={{ height: 38 }} />
          </Box>
          <Box sx={{ display: { xs: 'none', md: 'flex' }, alignItems: 'center', gap: 1 }}>
            <img src="/logo.svg" alt="Safr e Manasik" style={{ height: 42 }} />
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {/* Right: user info + avatar */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <Box sx={{ textAlign: 'right', display: { xs: 'none', sm: 'block' } }}>
              <Typography variant="body2" fontWeight={700} color="#1B4B35">{user?.name}</Typography>
              <Typography variant="caption" sx={{ color: roleColor, fontWeight: 600 }}>{roleLabel}</Typography>
            </Box>
            <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ p: 0.5 }}>
              <Avatar sx={{ width: 38, height: 38, bgcolor: roleColor, fontSize: 15, fontWeight: 800, border: `2px solid ${roleColor}33` }}>
                {user?.name?.charAt(0)}
              </Avatar>
            </IconButton>
          </Box>

          <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}
            transformOrigin={{ horizontal: 'right', vertical: 'top' }}
            anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
            PaperProps={{ sx: { mt: 0.5, minWidth: 180, boxShadow: '0 4px 20px rgba(27,75,53,0.15)', borderRadius: 2 } }}
          >
            <Box sx={{ px: 2, py: 1 }}>
              <Typography variant="caption" fontWeight={700} color="#1B4B35">{user?.name}</Typography>
              <Typography variant="caption" display="block" color="text.secondary" sx={{ fontSize: '0.68rem' }}>{user?.email}</Typography>
            </Box>
            <Divider />
            <MenuItem onClick={() => { navigate('/profile'); setAnchorEl(null); }} sx={{ gap: 1.5, color: '#1B4B35' }}>
              <Person fontSize="small" /> Profile
            </MenuItem>
            {user?.role === 'ADMIN' && (
              <MenuItem onClick={() => { navigate('/config'); setAnchorEl(null); }} sx={{ gap: 1.5, color: '#1B4B35' }}>
                <Settings fontSize="small" /> System Config
              </MenuItem>
            )}
            <Divider />
            <MenuItem onClick={handleLogout} sx={{ gap: 1.5, color: 'error.main' }}>
              <Logout fontSize="small" /> Sign Out
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {isMobile ? (
        <Drawer variant="temporary" open={mobileOpen} onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, bgcolor: '#0D2B1A' } }}>
          <Sidebar onClose={() => setMobileOpen(false)} />
        </Drawer>
      ) : (
        <Drawer variant="permanent"
          sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, bgcolor: '#0D2B1A', border: 'none' } }}>
          <Sidebar />
        </Drawer>
      )}

      <Box component="main" sx={{ flexGrow: 1, p: 3, mt: 8, minHeight: '100vh', bgcolor: '#F7F2E8' }}>
        <Outlet />
      </Box>
    </Box>
  );
}
