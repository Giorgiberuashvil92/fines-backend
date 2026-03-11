# marte-fines-backend (SA.gov.ge ჯარიმების proxy)

ცალკე სერვისი VPS-ზე გასაშვებად. **marte-backend** (Railway) ამ სერვისს იძახებს, ეს კი SA.gov.ge API-ს – ისე რომ ქსელის/შეზღუდვის პრობლემა Railway-დან SA-ზე არ იყოს.

## არქიტექტურა

```
აპი (React Native)  →  marte-backend (Railway)  →  fines-backend (VPS)  →  SA.gov.ge API
```

- **marte-backend**: იგივე fines API (ჯარიმები, მედია, რეგისტრაცია) – მაგრამ request-ები თუ `FINES_BACKEND_URL` არის დაყენებული, მიდის fines-backend-ზე.
- **fines-backend**: იღებს SA token-ს, პროქსირებს ყველა `/api/v1/*` request-ს SA Public API-ზე.

## VPS-ზე გაშვება

1. დააკლონირე ან ატვირთე `fines-backend` ფოლდერი სერვერზე.
2. დაამატე `.env` (იხ. `.env.example`):
   - `SA_CLIENT_ID`, `SA_CLIENT_SECRET` – იგივე რაც marte-backend-ში.
3. დააყენე dependencies და გაუშვი:
   ```bash
   npm install
   npm run build
   npm start
   ```
4. პორტი: `PORT=3100` (ან სხვა). nginx/caddy-ით გახსენი HTTPS, მაგ. `https://fines.yourdomain.com`.

## marte-backend-ის კონფიგურაცია

Railway (ან სადაცაც გაშვებული გაქვს marte-backend) env-ში დაამატე:

```env
FINES_BACKEND_URL=https://fines.yourdomain.com
```

(ან `http://VPS_IP:3100` თუ HTTPS არ იყენებ.)

ამის შემდეგ marte-backend ჯარიმების request-ებს fines-backend-ზე გაგზავნის, fines-backend კი SA-ს.

## ლოკალური ტესტი

```bash
cd fines-backend
cp .env.example .env
# შეავსე SA_CLIENT_SECRET
npm install
npm run dev
```

სხვა ტერმინალში marte-backend:

```env
FINES_BACKEND_URL=http://localhost:3100
```

აპი ისევ marte-backend-ს იძახებს; marte-backend → localhost:3100 (fines-backend) → SA.
