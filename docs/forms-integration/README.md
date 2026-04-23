# VaxAI Vision — Forms Integration

Both the **Contact Us** form (`/contact`) and the **Join Waitlist** form
(`/waitlist`) post into a single Google Sheet:

> **Contact US and Waitlist**
> https://docs.google.com/spreadsheets/d/1t0v1ABeqNZe26lCNlbxcOKDeBsW7Fu5dFgxpNIJWcfM/edit

A Google Apps Script deployed as a **Web App** sits between the forms and the
sheet. The forms submit JSON to the script URL; the script writes rows to two
tabs — `Contact Us` and `Waitlist` — creating them with headers if they don't
already exist.

---

## One-time setup (~5 minutes)

### 1. Open the sheet's script editor

1. Open the sheet: https://docs.google.com/spreadsheets/d/1t0v1ABeqNZe26lCNlbxcOKDeBsW7Fu5dFgxpNIJWcfM/edit
2. **Extensions → Apps Script**. A new script project opens.
3. Rename the project to `VaxAI Vision — Forms Intake` (top-left).

### 2. Paste the script

1. Delete the default `function myFunction() {}` placeholder in `Code.gs`.
2. Copy the entire contents of [`Code.gs`](./Code.gs) and paste it in.
3. Click the **disk icon** (save).

### 3. Deploy as a Web App

1. Click **Deploy → New deployment**.
2. Next to "Select type" click the gear icon → **Web app**.
3. Configure:
   - **Description:** `Forms intake v1`
   - **Execute as:** `Me (your@email)`
   - **Who has access:** `Anyone`
4. Click **Deploy**.
5. Grant the requested scopes (Sheets read/write on this spreadsheet).
6. Copy the **Web app URL** it gives you. It looks like:
   `https://script.google.com/macros/s/AKfycbx.../exec`

### 4. Smoke test the deployment

Paste the Web app URL into a browser. You should see a JSON response like:

```json
{ "ok": true, "sheet": "Contact US and Waitlist" }
```

If you see a Google sign-in page instead, revisit step 3 and set
**Who has access** to `Anyone` (not "Anyone with Google account").

### 5. Wire the URL into Vercel

The landing page (`src/`) is deployed on Vercel. Add the URL as an env var:

1. Vercel dashboard → the `vaxaivision.com` project → **Settings → Environment Variables**.
2. Add a new variable:
   - **Name:** `NEXT_PUBLIC_FORMS_ENDPOINT`
   - **Value:** the `/exec` URL from step 3
   - **Environments:** Production, Preview, Development (check all three)
3. Trigger a redeploy (Deployments → most recent → three-dot menu → Redeploy).

> `NEXT_PUBLIC_*` vars are baked in at **build** time, so the redeploy is required.

### 6. Test end-to-end

- Open `https://vaxaivision.com/contact`, fill the form, click **Send**.
- Open `https://vaxaivision.com/waitlist`, fill the form, click **Join the Waitlist**.
- Open the sheet — new rows should appear in the `Contact Us` and `Waitlist`
  tabs within a second or two.

---

## What if I need to update the script?

Edit `Code.gs` in the Apps Script editor, save, then:

- **Deploy → Manage deployments → pencil icon → Version: New version → Deploy.**

If you create a brand-new deployment (not an update to the existing one) the
`/exec` URL changes and you must update `NEXT_PUBLIC_FORMS_ENDPOINT` in Vercel.
**Always use "Manage deployments → edit existing"** to keep the URL stable.

## CORS notes

The client posts with `Content-Type: text/plain` so the browser treats the
request as "simple" and skips the CORS preflight — Apps Script Web Apps can't
respond to OPTIONS requests. The script reads the JSON payload out of
`e.postData.contents`.

## Payload shapes

Both endpoints accept the same JSON envelope; the `type` field routes the row
to the right tab.

**Contact**
```json
{
  "type": "contact",
  "first_name": "Ada",
  "last_name": "Lovelace",
  "email": "ada@example.com",
  "phone": "+2348011112222",
  "message": "Interested in a facility pilot.",
  "user_agent": "...",
  "referrer": "..."
}
```

**Waitlist**
```json
{
  "type": "waitlist",
  "full_name": "Ada Lovelace",
  "email": "ada@example.com",
  "organization": "Lagos State PHC",
  "role": "Program Director",
  "country": "Nigeria",
  "use_case": "facility_pilot",
  "user_agent": "...",
  "referrer": "..."
}
```

## Local development

Copy `.env.local.example` to `.env.local` in `VaxAI Vision Dev/` and paste the
same `/exec` URL into `NEXT_PUBLIC_FORMS_ENDPOINT`. `next dev` will pick it up.
Without the env var set, the form shows an inline "Form is not configured"
toast instead of silently dropping submissions.
