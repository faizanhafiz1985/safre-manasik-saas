# PayPal Setup Guide

This walkthrough gets you from "I have a PayPal Business account" to a fully wired-up payment gateway in **about 5 minutes**.

You will need:
- A PayPal Business account (you already have this — great)
- A web browser

You will end up with:
- `PAYPAL_CLIENT_ID`
- `PAYPAL_CLIENT_SECRET`
- Both for **sandbox** (testing) and **live** (real money)

---

## Step 1 — Open the PayPal Developer Dashboard

Go to **<https://developer.paypal.com/dashboard/applications/sandbox>** and sign in with your PayPal Business account.

You'll land on the **Apps & Credentials** page. There are two tabs at the top:
- **Sandbox** (fake money, for testing)
- **Live** (real money, for production)

Stay on **Sandbox** for now.

---

## Step 2 — Create a Sandbox App

Click the **Create App** button on the right.

Fill in:
- **App Name**: `Safre Manasik`
- **Type**: Merchant
- **Sandbox Account**: pick the default (`sb-...@business.example.com`)

Click **Create App**.

---

## Step 3 — Copy your Sandbox credentials

You're now on the app's detail page. You'll see two fields:

| Field | What it looks like |
|---|---|
| **Client ID** | `AYSq3RDGsmBLJE-otTkBtM-jBRd1TCQwFf9RGfwddNXWz0uFU9ztymylOhRS` |
| **Secret key 1** | Click "Show" to reveal — a 80-char string |

**Copy both.** You'll paste them into Railway in a few minutes.

---

## Step 4 — Test in sandbox mode

Once the app is deployed (see [SETUP_RAILWAY.md](SETUP_RAILWAY.md)), set on the **backend** service:

```
PAYPAL_MODE=sandbox
PAYPAL_CLIENT_ID=<your sandbox client ID>
PAYPAL_CLIENT_SECRET=<your sandbox secret>
```

Now log into the app, open any booking, click **"Pay with PayPal"** — it will redirect to PayPal's sandbox login. Sign in with a sandbox buyer account (PayPal provides one — see Developer Dashboard → Testing Tools → Sandbox Accounts).

The capture handler at `/payment/paypal/success` will record the payment and update the invoice automatically.

---

## Step 5 — Switching to Live (real money)

Once you've tested in sandbox and you're ready to take real payments:

1. Go back to **<https://developer.paypal.com/dashboard/applications/live>** (note: `/live`, not `/sandbox`)
2. Click **Create App** again (yes, separately — PayPal keeps them isolated)
3. Same fields as before: name "Safre Manasik", type "Merchant"
4. Copy the **live** Client ID and Secret
5. In Railway → Backend service → Variables, update:
   ```
   PAYPAL_MODE=live
   PAYPAL_CLIENT_ID=<your LIVE client ID>
   PAYPAL_CLIENT_SECRET=<your LIVE secret>
   ```
6. Redeploy (Railway does this automatically when variables change)

That's it — you're taking real money.

---

## Optional — Configure webhooks

PayPal can notify your server when events happen (refunds, disputes, etc.). The app has a webhook endpoint already configured at:

```
https://<your-backend-url>/api/payments/gateway/paypal/webhook
```

To register it:

1. PayPal Developer → your app → **Webhooks** section
2. Click **Add Webhook**
3. **URL**: paste the URL above
4. **Events**: tick at least these:
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.REFUNDED`
   - `PAYMENT.CAPTURE.DENIED`
5. Save

The webhook handler logs every event and processes refunds. For higher rigor, you can implement PayPal's signature verification — the SDK supports it.

---

## Currency note

PayPal does **not** support Saudi Riyal (SAR) as a transaction currency. The backend automatically converts SAR amounts to USD (using a 3.75 peg) at checkout time, and stores the converted amount in the Payment record.

If you need to charge in EUR / GBP / AED, change the booking's `currency` field before checkout.

---

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| "PayPal init failed" | Missing client ID/secret | Check Railway env vars |
| Sandbox login loops | Wrong `PAYPAL_MODE` | Set `PAYPAL_MODE=sandbox` for sandbox creds, `live` for live creds |
| "INVALID_RESOURCE_ID" on capture | Order was already captured | Each order can only be captured once; create a new one |
| Webhook not firing | URL not registered | Re-check PayPal dashboard → Webhooks |

---

## Quick reference

| Variable | Sandbox value | Live value |
|---|---|---|
| `PAYPAL_MODE` | `sandbox` | `live` |
| `PAYPAL_CLIENT_ID` | from sandbox app | from live app |
| `PAYPAL_CLIENT_SECRET` | from sandbox app | from live app |

Done. Move on to [SETUP_RAILWAY.md](SETUP_RAILWAY.md) for deployment.
