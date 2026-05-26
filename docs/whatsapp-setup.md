# Meta WhatsApp Cloud API — EduNexus Setup Guide

## Overview

EduNexus uses the **Meta WhatsApp Business Cloud API** (free tier) to send instant
push notifications to parents when:
- A teacher marks an assignment
- A teacher creates a student alert

WhatsApp fires in parallel with email. One channel failing never blocks the other.

---

## Step 1A — Meta Business Account Setup

### Prerequisites
- A Facebook account (personal or business)
- A phone number that is **not already registered on WhatsApp** (this will become your business sending number)
- A verified business (or individual developer account for testing)

### 1. Create a Meta Business Account

1. Go to **[business.facebook.com](https://business.facebook.com)**
2. Click **Create Account**
3. Fill in:
   - Business name: `EduNexus`
   - Your name and business email
4. Verify your email address when prompted

---

## Step 1B — Create a Meta App

1. Go to **[developers.facebook.com](https://developers.facebook.com)**
2. Click **My Apps → Create App**
3. Select **Other** as the use case → click **Next**
4. Select **Business** as the app type → click **Next**
5. Fill in:
   - App name: `EduNexus Notifications`
   - App contact email: your dev email
   - Business account: select the account you created in 1A
6. Click **Create App**

---

## Step 1C — Add WhatsApp to Your App

1. In your app dashboard, scroll to **Add products to your app**
2. Find **WhatsApp** → click **Set up**
3. Select your Meta Business Account → click **Continue**

You are now in the **WhatsApp Business Platform** setup wizard.

---

## Step 1D — Get Your Credentials

In the WhatsApp → **API Setup** section you will see:

| Field | Where to find it | .env.local variable |
|-------|-----------------|---------------------|
| Phone Number ID | "From" phone number dropdown → copy the ID below it | `WHATSAPP_PHONE_NUMBER_ID` |
| WhatsApp Business Account ID | Shown at the top of the API Setup page | `WHATSAPP_BUSINESS_ACCOUNT_ID` |
| Temporary access token | "Access token" section (valid 24 hrs) | `WHATSAPP_ACCESS_TOKEN` (for testing only) |

### Generate a Permanent Access Token

The temporary token expires in 24 hours. For production:

1. Go to **Business Settings → System Users**
2. Click **Add** → create a system user named `edunexus-api`
3. Set role to **Admin**
4. Click **Generate New Token**
5. Select your app (`EduNexus Notifications`)
6. Grant permission: `whatsapp_business_messaging`
7. Copy the token — this is permanent and goes in `.env.local` as `WHATSAPP_ACCESS_TOKEN`

---

## Step 1E — Add a Test Phone Number

For development, Meta provides a **free test sending number** (no approval needed).

1. In **WhatsApp → API Setup**, find the "From" phone number — it shows the Meta test number
2. Under "To", click **Manage phone number list**
3. Add your own phone number (the developer's personal WhatsApp)
4. You will receive a WhatsApp verification code — enter it
5. You can now send template messages to your own number for free during testing

---

## Step 1F — Create Message Templates

Templates must be approved by Meta before use in production.
In development against the test number, you can use the pre-approved `hello_world` template to verify your setup works.

For EduNexus, submit these two templates:

---

### Template 1: `edunexus_assignment_marked`

**Category:** `UTILITY`
**Language:** `en`

**Body (exact text to paste into Meta Business Manager):**

```
Hi {{1}}! {{2}}'s *{{3}}* assignment has been marked by {{4}}.

Score: *{{5}}/{{6}}* ({{7}}%)
CBC Level: {{8}}

Feedback: {{9}}

{{10}}
```

**Variable mapping (order matters):**

| Variable | Value |
|----------|-------|
| `{{1}}` | Parent name |
| `{{2}}` | Student name |
| `{{3}}` | Subject |
| `{{4}}` | Teacher name |
| `{{5}}` | Score |
| `{{6}}` | Max score |
| `{{7}}` | Percentage |
| `{{8}}` | CBC Level label (e.g. "L3 - Meets Expectation") |
| `{{9}}` | Teacher feedback (truncated to 120 chars) |
| `{{10}}` | Deep link URL |

**Sample message:**
```
Hi Jane! Ali's *Mathematics* assignment has been marked by Mr. Otieno.

Score: *42/50* (84%)
CBC Level: L4 - Exceeds Expectation

Feedback: Excellent work on algebra. Practice geometry next.

https://edunexus.co.ke/dashboard/assignments/abc-123
```

---

### Template 2: `edunexus_student_alert`

**Category:** `UTILITY`
**Language:** `en`

**Body (exact text to paste into Meta Business Manager):**

```
Hi {{1}}! {{2}}'s teacher {{3}} has sent a school alert.

Type: {{4}}

{{5}}

Log in to EduNexus to view full details: {{6}}
```

**Variable mapping:**

| Variable | Value |
|----------|-------|
| `{{1}}` | Parent name |
| `{{2}}` | Student name |
| `{{3}}` | Teacher name |
| `{{4}}` | Alert type label |
| `{{5}}` | Teacher message (truncated to 200 chars) |
| `{{6}}` | Deep link URL |

**Sample message:**
```
Hi Jane! Ali's teacher Mr. Otieno has sent a school alert.

Type: Overdue Assignment

Ali has not submitted the Mathematics homework due last Friday. Please remind them to complete it.

Log in to EduNexus to view full details: https://edunexus.co.ke/dashboard/alerts
```

---

### How to submit templates for approval

1. Go to **WhatsApp → Message Templates → Create Template**
2. Select category: `Utility`
3. Select language: `English`
4. Enter template name exactly as shown (e.g. `edunexus_assignment_marked`)
5. Paste the body text above
6. Click **Submit**

Approval typically takes **a few minutes to 24 hours**.
You will receive an email from Meta when approved.

---

## Step 1G — Add a Production Phone Number

When ready for production (real parents):

1. In **WhatsApp → Phone Numbers → Add Phone Number**
2. Enter your EduNexus business number
3. Choose verification method (SMS or voice call)
4. Verify and add the number
5. Copy the new **Phone Number ID** → update `WHATSAPP_PHONE_NUMBER_ID` in `.env.local`

> The production number must belong to EduNexus, not the developer's personal phone.
> The number cannot already be registered on WhatsApp (it will be de-registered if it is).

---

## Step 1H — Add Environment Variables

Add to `.env.local`:

```env
# WhatsApp (Meta Cloud API)
WHATSAPP_PHONE_NUMBER_ID=your_phone_number_id_here
WHATSAPP_ACCESS_TOKEN=your_permanent_system_user_token_here
WHATSAPP_BUSINESS_ACCOUNT_ID=your_waba_id_here

# Email (Resend — already configured)
RESEND_API_KEY=re_xxxxxxxxxxxx

# App
NEXT_PUBLIC_APP_URL=https://edunexus.co.ke
```

---

## Step 1I — Storing Parent Phone Numbers

The `students` table now has:
- `parent_phone TEXT` — E.164 format, e.g. `254712345678` (no `+`)
- `notification_whatsapp BOOLEAN DEFAULT true`

When a parent onboards or updates their profile, store their WhatsApp number in E.164 format.
**Kenya numbers:** strip the leading `0` and prepend `254` — e.g. `0712345678` → `254712345678`.

---

## Testing Checklist

- [ ] Meta app created and WhatsApp product added
- [ ] Credentials saved to `.env.local`
- [ ] Developer personal number added to test whitelist
- [ ] `hello_world` template sends successfully to test number
- [ ] Both custom templates (`edunexus_assignment_marked`, `edunexus_student_alert`) submitted for approval
- [ ] Templates approved by Meta
- [ ] Test student row has `parent_phone` set to a whitelisted number
- [ ] Mark an assignment → WhatsApp + email both arrive
- [ ] Create an alert → WhatsApp + email both arrive
- [ ] Check `notification_log` table: two rows per event (one `channel='email'`, one `channel='whatsapp'`)

---

## Free Tier Limits

| Limit | Value |
|-------|-------|
| Conversations/month free | 1,000 |
| Template message rate | 80 per second |
| Test phone numbers | 5 |
| Template approval | Free |

A "conversation" is a 24-hour window. Each parent gets one free conversation per day regardless of how many messages are sent inside it.

At 50 pioneer teachers with ~20 students each, worst-case is ~1,000 WhatsApp conversations/month — exactly at the free tier limit. Monitor usage in Meta Business Manager.
