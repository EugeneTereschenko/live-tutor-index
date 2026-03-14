# Gemini Live Tutor

An AI-powered language tutoring app built with a Node.js/WebSocket backend (Gemini / Vertex AI) and a React + Vite frontend.

- **Backend source**: https://github.com/EugeneTereschenko/ai-language-tutor
- **Frontend source**: https://github.com/EugeneTereschenko/tutor-ui




---

## Architecture overview

```
Browser (React + Vite)
    │  WSS /ws  (tutor.text / tutor.multimodal)
    ▼
Node.js backend (Express + ws)
    │
    ▼
Vertex AI — Gemini 2.5 Flash
```

The frontend proxies WebSocket traffic through Vite's dev server (`/ws → https://localhost:8080`) so both sides can run over HTTPS/WSS locally without CORS issues.

---

## Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 18 LTS |
| npm | 9 |
| (optional) Google Cloud SDK | for Vertex AI mode |

---

## Backend

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Environment variables

Create a `.env` file in `backend/` (copy the block below and fill in values):

```env
# Required for Vertex AI mode — omit to run in local fallback mode
USE_VERTEX_AI=false
GOOGLE_CLOUD_PROJECT=your-project-id
GOOGLE_CLOUD_LOCATION=us-central1   # optional, default: us-central1
GEMINI_MODEL=gemini-2.5-flash        # optional

# HTTPS (local dev with self-signed certs)
USE_HTTPS=false
SSL_KEY_PATH=certs/dev-key.pem
SSL_CERT_PATH=certs/dev-cert.pem

# Server port (default: 8080)
PORT=8080
```

### 3. Start (local / no cloud cost)

```bash
npm start
```

The server listens on `http://localhost:8080`.

- `GET /health` — returns current mode and model name.
- `GET /` — returns the accepted WebSocket message schema.
- `ws://localhost:8080/ws` — WebSocket endpoint.

### 4. Start with HTTPS (required when the frontend uses `basicSsl`)

Generate a self-signed cert once:

```bash
mkdir -p certs
openssl req -x509 -newkey rsa:2048 -nodes \
  -keyout certs/dev-key.pem \
  -out  certs/dev-cert.pem \
  -days 365 -subj "/CN=localhost"
```

Then start the secure server:

```bash
npm run start:secure
```

Server now listens on `https://localhost:8080`.

### 5. Start in Vertex AI / cloud mode

```bash
export USE_VERTEX_AI=true
export GOOGLE_CLOUD_PROJECT=your-project-id
npm start
```

Authenticate with Application Default Credentials if running locally:

```bash
gcloud auth application-default login
```

---

## Frontend

### 1. Install dependencies

```bash
cd frontend
npm install
```

### 2. Start the development server

```bash
npm run dev
```

Vite starts at **https://localhost:5173** (HTTPS is enabled by the `@vitejs/plugin-basic-ssl` plugin).

> **Note:** Accept the self-signed certificate warning in your browser on first launch.

The dev server proxies all `/ws` traffic to `https://localhost:8080`, so you only need the backend running — no extra proxy configuration is needed.

### 3. Lint

```bash
npm run lint
```

### 4. Production build

```bash
npm run build        # outputs to frontend/dist/
npm run preview      # serves the dist/ folder locally on https://localhost:5173
```

---

## Running both together (local development)

Open two terminals:

```bash
# Terminal 1 — backend
cd backend && npm run start:secure

# Terminal 2 — frontend
cd frontend && npm run dev
```

Open **https://localhost:5173** in your browser.

---

## WebSocket message protocol

### Client → server — text tutoring

```json
{
  "type": "tutor.text",
  "requestId": "req-1",
  "payload": {
    "text": "I goed to school yesterday"
  }
}
```

### Client → server — multimodal (image + text)

```json
{
  "type": "tutor.multimodal",
  "requestId": "req-2",
  "payload": {
    "text": "Help me answer this worksheet",
    "mimeType": "image/png",
    "imageBase64": "<base64-encoded-bytes>"
  }
}
```

### Server → client — success

```json
{
  "type": "tutor.response",
  "requestId": "req-1",
  "payload": {
    "text": "...",
    "source": "gemini",
    "model": "gemini-2.5-flash"
  },
  "timestamp": "2026-03-14T12:00:00.000Z"
}
```

### Server → client — error

```json
{
  "type": "tutor.error",
  "requestId": "req-1",
  "payload": { "message": "Internal error" },
  "timestamp": "2026-03-14T12:00:00.000Z"
}
```

---

## Deployment

### Backend → Cloud Run

Source: https://github.com/EugeneTereschenko/ai-language-tutor

```bash
gcloud run deploy ai-language-tutor \
  --source backend/ \
  --region us-central1 \
  --set-env-vars USE_VERTEX_AI=true,GOOGLE_CLOUD_PROJECT=<project>
```

### Frontend → Firebase Hosting

Source: https://github.com/EugeneTereschenko/tutor-ui

```bash
cd frontend
npm run build
firebase deploy --only hosting
```

CI/CD via GitHub Actions is pre-configured in the frontend repo:

- **Pull request** → preview channel (expires in 7 days).
- **Push to `main`** → live channel.

Required repository secrets: `FIREBASE_PROJECT_ID`, `FIREBASE_SERVICE_ACCOUNT`.

