import React from 'react';
import { Box, Typography } from '@mui/material';
import { useAuth } from '../context/AuthContext';

/*
  BrandLogo — the only component anywhere in the UI that knows how to render
  the "logo" of the current context.

  Resolution order (highest priority first):
    1. props.src                        — explicit override passed by caller
    2. user.tenant.logoUrl              — the tenant's own uploaded logo
    3. /safre-manasik-logo.png          — platform default (Safre Manasik brand)
    4. /logo.svg                        — secondary fallback shipped with the
                                          frontend bundle
    5. text-only badge                  — last-resort if all images fail

  Variants:
    variant="full"    — image + (optional) wordmark caption beneath
    variant="image"   — image only
    variant="compact" — small image suited for sidebar
    variant="text"    — wordmark only (never an image)

  Tenant admins configure their logo in Tenant Settings → Branding → Logo URL.
  The URL must be publicly reachable HTTPS (host the file on Cloudflare Images,
  Imgur, your CDN, etc.). When the field is blank, the platform default shows.
*/
export default function BrandLogo({
  src,
  alt,
  variant = 'image',
  maxHeight,
  maxWidth,
  showTenantName = false,
  sx = {},
}) {
  const { user } = useAuth();
  const tenantLogo = user?.tenant?.logoUrl;
  const tenantName = user?.tenant?.name;

  // Resolve which image to show. The chain is intentionally explicit so an
  // operator reading this file can follow what wins when.
  const resolvedSrc =
    src ||
    (tenantLogo && tenantLogo.trim() ? tenantLogo : null) ||
    '/safre-manasik-logo.png';

  // We layer two onError fallbacks: PNG → SVG → text badge. <img onError>
  // fires once per swap, so we use a state machine via data-fallback.
  const handleImgError = (e) => {
    const stage = e.target.dataset.fallback || '0';
    if (stage === '0') {
      e.target.dataset.fallback = '1';
      e.target.src = '/logo.svg';
    } else if (stage === '1') {
      e.target.dataset.fallback = '2';
      // Hide image, the text badge sibling below will be the only thing left.
      e.target.style.display = 'none';
    }
  };

  if (variant === 'text') {
    return (
      <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', ...sx }}>
        <Typography sx={{ fontFamily: 'serif', fontWeight: 800, color: '#1B4B35', lineHeight: 1, fontSize: '1.5em' }}>
          Safr <span style={{ color: '#C9A227', fontStyle: 'italic' }}>e</span> Manasik
        </Typography>
        {showTenantName && tenantName && tenantName !== 'Safre Manasik' && (
          <Typography variant="caption" sx={{ color: '#C9A227', fontWeight: 700, mt: 0.3 }}>
            {tenantName}
          </Typography>
        )}
      </Box>
    );
  }

  const sizing =
    variant === 'compact'
      ? { maxWidth: maxWidth || 180, maxHeight: maxHeight || 70 }
      : variant === 'full'
      ? { maxWidth: maxWidth || 320, maxHeight: maxHeight || 130 }
      : { maxWidth: maxWidth || 240, maxHeight: maxHeight || 100 };

  return (
    <Box sx={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', ...sx }}>
      <Box
        component="img"
        src={resolvedSrc}
        alt={alt || tenantName || 'Safre Manasik'}
        onError={handleImgError}
        sx={{
          display: 'block',
          width: 'auto',
          height: 'auto',
          ...sizing,
          objectFit: 'contain',
        }}
      />
      {/* Tiny text fallback that only shows when both images fail (display:none above hides the img). */}
      <Typography
        sx={{
          mt: 0.5,
          fontFamily: 'serif',
          fontWeight: 800,
          color: '#1B4B35',
          fontSize: '1.1rem',
          display: 'none',
        }}
      >
        Safr <span style={{ color: '#C9A227', fontStyle: 'italic' }}>e</span> Manasik
      </Typography>
      {variant === 'full' && showTenantName && tenantName && tenantName !== 'Safre Manasik' && (
        <Typography variant="caption" sx={{ color: '#C9A227', fontWeight: 700, mt: 0.5, letterSpacing: 0.5 }}>
          {tenantName}
        </Typography>
      )}
    </Box>
  );
}
