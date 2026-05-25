import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Box, Typography, Card, List, ListItem, ListItemText, ListItemAvatar,
  Avatar, Chip, TextField, IconButton, CircularProgress, Divider,
  InputAdornment, Badge, Alert, Snackbar, Button, Tooltip,
} from '@mui/material';
import { Send, WhatsApp, Facebook, Instagram, Email, Search, Refresh, CheckCircle } from '@mui/icons-material';
import { crmInbox } from '../../services/crmApi';
import { useAuth } from '../../context/AuthContext';

const CHANNEL_ICONS = {
  WHATSAPP: <WhatsApp sx={{ fontSize: 18, color: '#25D366' }} />,
  FACEBOOK: <Facebook sx={{ fontSize: 18, color: '#1877F2' }} />,
  INSTAGRAM: <Instagram sx={{ fontSize: 18, color: '#E4405F' }} />,
  INTERNAL: <Email sx={{ fontSize: 18, color: '#6366F1' }} />,
  EMAIL: <Email sx={{ fontSize: 18, color: '#6366F1' }} />,
};

const CHANNEL_COLORS = {
  WHATSAPP: '#25D366', FACEBOOK: '#1877F2', INSTAGRAM: '#E4405F', INTERNAL: '#6366F1', EMAIL: '#6366F1',
};

export default function CrmInboxPage() {
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [selectedConv, setSelectedConv] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);
  const [search, setSearch] = useState('');
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const messagesEndRef = useRef(null);

  const loadConversations = useCallback(() => {
    setLoading(true);
    crmInbox.getConversations({ ...(search && { search }), limit: 50 })
      .then((r) => setConversations(r.data.data || []))
      .catch(() => setSnackbar({ open: true, message: 'Failed to load conversations', severity: 'error' }))
      .finally(() => setLoading(false));
  }, [search]);

  const loadMessages = useCallback((convId) => {
    setMsgLoading(true);
    crmInbox.getConversation(convId)
      .then((r) => {
        setMessages(r.data.messages || []);
        crmInbox.markRead(convId).catch(() => {});
        // Refresh conversation list to update unread count
        loadConversations();
      })
      .catch(() => setSnackbar({ open: true, message: 'Failed to load messages', severity: 'error' }))
      .finally(() => setMsgLoading(false));
  }, [loadConversations]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  useEffect(() => {
    if (selectedConv) loadMessages(selectedConv.id);
  }, [selectedConv?.id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!messageText.trim() || !selectedConv) return;
    setSending(true);
    try {
      await crmInbox.sendMessage(selectedConv.id, { body: messageText.trim() });
      setMessageText('');
      loadMessages(selectedConv.id);
    } catch (e) {
      setSnackbar({ open: true, message: e.response?.data?.error || 'Failed to send', severity: 'error' });
    } finally { setSending(false); }
  };

  const handleResolve = async (id) => {
    try {
      await crmInbox.resolve(id);
      setSnackbar({ open: true, message: 'Conversation resolved', severity: 'success' });
      setSelectedConv(null);
      loadConversations();
    } catch { setSnackbar({ open: true, message: 'Failed', severity: 'error' }); }
  };

  return (
    <Box sx={{ display: 'flex', height: 'calc(100vh - 80px)', p: 2, gap: 2 }}>
      {/* Conversation List */}
      <Card sx={{ width: 320, flexShrink: 0, borderRadius: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Box sx={{ p: 2, borderBottom: '1px solid #f0f0f0' }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
            <Typography variant="h6" fontWeight={700} color="#1B4B35">Inbox</Typography>
            <Tooltip title="Refresh"><IconButton size="small" onClick={loadConversations}><Refresh /></IconButton></Tooltip>
          </Box>
          <TextField size="small" fullWidth placeholder="Search conversations..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }} />
        </Box>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
        ) : (
          <List sx={{ overflowY: 'auto', flex: 1, p: 0 }}>
            {conversations.map((conv) => {
              const lastMsg = conv.messages?.[0];
              const isSelected = selectedConv?.id === conv.id;
              return (
                <ListItem
                  key={conv.id}
                  button
                  onClick={() => setSelectedConv(conv)}
                  sx={{
                    borderBottom: '1px solid #f5f5f5',
                    bgcolor: isSelected ? '#1B4B3510' : 'transparent',
                    borderLeft: isSelected ? '3px solid #1B4B35' : '3px solid transparent',
                    '&:hover': { bgcolor: '#f8f9fa' },
                  }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: `${CHANNEL_COLORS[conv.channel]}20`, width: 40, height: 40 }}>
                      {CHANNEL_ICONS[conv.channel] || <Email fontSize="small" />}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Typography variant="body2" fontWeight={600} noWrap sx={{ flex: 1 }}>
                          {conv.participantName || conv.lead?.fullName || 'Unknown'}
                        </Typography>
                        {conv.isResolved && <Chip label="Resolved" size="small" color="success" sx={{ fontSize: '0.6rem', height: 16 }} />}
                      </Box>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary" noWrap>
                        {lastMsg?.body || 'No messages yet'}
                      </Typography>
                    }
                  />
                </ListItem>
              );
            })}
            {conversations.length === 0 && (
              <Box sx={{ textAlign: 'center', py: 6, px: 2 }}>
                <Typography variant="body2" color="text.secondary">No conversations yet</Typography>
                <Typography variant="caption" color="text.secondary">
                  Messages from WhatsApp, Facebook, and Instagram will appear here
                </Typography>
              </Box>
            )}
          </List>
        )}
      </Card>

      {/* Message Thread */}
      {selectedConv ? (
        <Card sx={{ flex: 1, borderRadius: 2, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          {/* Header */}
          <Box sx={{ px: 3, py: 2, borderBottom: '1px solid #f0f0f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Avatar sx={{ bgcolor: `${CHANNEL_COLORS[selectedConv.channel]}20` }}>
                {CHANNEL_ICONS[selectedConv.channel]}
              </Avatar>
              <Box>
                <Typography variant="body1" fontWeight={700}>
                  {selectedConv.participantName || selectedConv.lead?.fullName || 'Unknown'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {selectedConv.channel} · {selectedConv.participantPhone || selectedConv.participantEmail || '—'}
                </Typography>
              </Box>
            </Box>
            {!selectedConv.isResolved && (
              <Button size="small" startIcon={<CheckCircle />} onClick={() => handleResolve(selectedConv.id)}
                variant="outlined" sx={{ borderColor: '#10B981', color: '#10B981', fontSize: '0.75rem' }}>
                Resolve
              </Button>
            )}
          </Box>

          {/* Messages */}
          <Box sx={{ flex: 1, overflowY: 'auto', p: 2, bgcolor: '#f9fafb' }}>
            {msgLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}><CircularProgress size={28} /></Box>
            ) : messages.length === 0 ? (
              <Typography variant="body2" color="text.secondary" textAlign="center" mt={4}>
                No messages in this conversation yet.
              </Typography>
            ) : (
              messages.map((msg) => {
                const isOut = msg.direction === 'OUTBOUND';
                return (
                  <Box key={msg.id} sx={{ display: 'flex', justifyContent: isOut ? 'flex-end' : 'flex-start', mb: 1.5 }}>
                    <Box sx={{
                      maxWidth: '72%', p: 1.5, borderRadius: isOut ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                      bgcolor: isOut ? '#1B4B35' : '#fff',
                      color: isOut ? '#fff' : 'text.primary',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                    }}>
                      {!isOut && msg.sentBy && (
                        <Typography variant="caption" sx={{ fontWeight: 700, color: '#1B4B35', display: 'block', mb: 0.5 }}>
                          {msg.sentBy.name}
                        </Typography>
                      )}
                      <Typography variant="body2">{msg.body}</Typography>
                      <Typography variant="caption" sx={{ opacity: 0.7, display: 'block', textAlign: 'right', mt: 0.5, fontSize: '0.65rem' }}>
                        {new Date(msg.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        {isOut && msg.deliveryStatus && ` · ${msg.deliveryStatus}`}
                      </Typography>
                    </Box>
                  </Box>
                );
              })
            )}
            <div ref={messagesEndRef} />
          </Box>

          {/* Input */}
          {!selectedConv.isResolved ? (
            <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid #f0f0f0', display: 'flex', gap: 1, alignItems: 'center' }}>
              <TextField
                fullWidth size="small" placeholder="Type a message..."
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                multiline maxRows={3}
              />
              <IconButton onClick={handleSend} disabled={sending || !messageText.trim()}
                sx={{ bgcolor: '#1B4B35', color: '#fff', '&:hover': { bgcolor: '#2E6B4F' }, '&.Mui-disabled': { bgcolor: '#ccc' } }}>
                {sending ? <CircularProgress size={18} color="inherit" /> : <Send fontSize="small" />}
              </IconButton>
            </Box>
          ) : (
            <Box sx={{ px: 2, py: 1.5, borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
              <Typography variant="caption" color="text.secondary">This conversation has been resolved.</Typography>
            </Box>
          )}
        </Card>
      ) : (
        <Card sx={{ flex: 1, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Box sx={{ textAlign: 'center' }}>
            <Avatar sx={{ width: 64, height: 64, bgcolor: '#1B4B3510', mx: 'auto', mb: 2 }}>
              <Email sx={{ color: '#1B4B35', fontSize: 32 }} />
            </Avatar>
            <Typography variant="h6" color="text.secondary">Select a conversation</Typography>
            <Typography variant="body2" color="text.secondary">Choose from the left panel to view messages</Typography>
          </Box>
        </Card>
      )}

      <Snackbar open={snackbar.open} autoHideDuration={4000} onClose={() => setSnackbar({ ...snackbar, open: false })}>
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Box>
  );
}
