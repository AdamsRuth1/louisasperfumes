# Velvet Aura Perfumes

Backend-powered perfume landing page with:

- responsive storefront and brand story
- search by perfume name, manufacturer, and notes
- black and white theme toggle
- WhatsApp ordering links
- catalog-based recommendation assistant
- secure admin login with HttpOnly session cookie
- server-side product storage in `data/products.json`
- image upload storage in `data/uploads/`
- admin stock toggling for sold-out perfumes

## Run locally

1. Set admin secrets in PowerShell:

```powershell
$env:ADMIN_USERNAME="admin"
$env:ADMIN_PASSWORD="ChangeMeToAStrongPassword"
$env:SESSION_SECRET="replace-with-a-long-random-secret"
```

2. Start the app:

```powershell
npm start
```

3. Open [http://127.0.0.1:3000](http://127.0.0.1:3000)

## Important placeholders to update

Update these values in [index.html](C:/Users/USER/Documents/Codex/2026-04-19-create-a-pefume-website-it-shold/index.html:1):

- phone number link in the contact section
- TikTok profile link

Update the WhatsApp order number in [app.js](C:/Users/USER/Documents/Codex/2026-04-19-create-a-pefume-website-it-shold/app.js:1) if needed.

## Security notes

- Admin authentication is now handled on the server.
- Session cookies are `HttpOnly` and `SameSite=Strict`.
- Product edits require authenticated admin API access.
- Uploaded images are validated and size-limited before saving.

## Data storage

- Products are stored in `data/products.json`
- Uploaded perfume images are stored in `data/uploads/`

The first server start seeds the catalog automatically if no product file exists.
