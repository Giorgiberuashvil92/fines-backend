/**
 * SA.gov.ge ჯარიმების API proxy.
 * VPS-ზე გაშვება – marte-backend (Railway) ამ სერვისს იძახებს, ეს კი SA API-ს.
 * env: SA_CLIENT_ID, SA_CLIENT_SECRET, PORT (default 3100)
 */

import express from 'express';
import cors from 'cors';

const SA_IDENTITY_URL =
  process.env.SA_IDENTITY_URL || 'https://api-identity.sa.gov.ge/connect/token';
const SA_PUBLIC_API_URL =
  process.env.SA_PUBLIC_API_URL || 'https://api-public.sa.gov.ge/api/v1';
const PORT = parseInt(process.env.PORT || '3100', 10);

let cachedToken: string | null = null;
let tokenExpiry = 0;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) {
    return cachedToken;
  }

  const clientId = process.env.SA_CLIENT_ID;
  const clientSecret = process.env.SA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('SA_CLIENT_ID და SA_CLIENT_SECRET სავალდებულოა .env-ში');
  }

  const formData = new URLSearchParams();
  formData.append('client_id', clientId);
  formData.append('client_secret', clientSecret);
  formData.append('grant_type', 'client_credentials');

  const res = await fetch(SA_IDENTITY_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error('❌ Token error:', res.status, text);
    throw new Error(`Token მოპოვება ვერ მოხერხდა: ${res.status}`);
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  if (!data.access_token) {
    throw new Error('Token response-ში არ არის access_token');
  }

  cachedToken = data.access_token;
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
  console.log('✅ SA token მიღებულია');
  return cachedToken;
}

const app = express();
app.use(cors());
app.use(express.json());

// ყველა /api/v1/* პროქსირდება SA Public API-ზე
app.all('/api/v1/*', async (req, res) => {
  const path = req.path.replace(/^\/api\/v1/, '') || '/';
  const query = req.url.includes('?') ? req.url.slice(req.url.indexOf('?')) : '';
  const url = `${SA_PUBLIC_API_URL}${path}${query}`;

  try {
    const token = await getAccessToken();
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(req.headers['content-type'] && {
        'Content-Type': req.headers['content-type'] as string,
      }),
    };

    const fetchOpts: RequestInit = {
      method: req.method,
      headers,
    };
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.body) {
      fetchOpts.body =
        typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const saRes = await fetch(url, fetchOpts);
    const contentType = saRes.headers.get('content-type') || 'application/json';

    if (!saRes.ok) {
      const text = await saRes.text();
      console.error('❌ SA API error:', saRes.status, url, text.slice(0, 200));
      res.status(saRes.status).set('Content-Type', contentType).send(text);
      return;
    }

    if (contentType.includes('application/json')) {
      const json = await saRes.json();
      res.json(json);
    } else {
      const text = await saRes.text();
      res.set('Content-Type', contentType).send(text);
    }
  } catch (e) {
    console.error('❌ Proxy error:', e);
    res
      .status(502)
      .json({
        error: 'SA API-ს მიღება ვერ მოხერხდა',
        message: e instanceof Error ? e.message : String(e),
      });
  }
});

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'marte-fines-backend' });
});

app.listen(PORT, () => {
  console.log(`🚀 Fines backend (SA proxy) listening on port ${PORT}`);
  console.log(`   SA_PUBLIC_API_URL: ${SA_PUBLIC_API_URL}`);
});
