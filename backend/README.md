# AI Language Tutor Agent (Gemini + Vertex AI)

This project is a challenge-ready AI agent backend for the Gemini Live Agent Challenge. It supports:

- WebSocket agent interaction
- Text tutoring (`tutor.text`)
- Multimodal tutoring with image + text (`tutor.multimodal`)
- Gemini on Vertex AI (cloud mode)
- Local fallback mode (no cloud cost)

## Quick start

1. Install dependencies:

    ```bash
    npm install
    ```

2. Run local mode (no cloud calls):

    ```bash
    npm start
    ```

3. Or run HTTPS/WSS mode with local dev certs:

    ```bash
    npm run start:secure
    ```

## Cloud mode (Vertex AI)

Set the following environment variables:

- `USE_VERTEX_AI=true`
- `GOOGLE_CLOUD_PROJECT=your-project-id`
- `GOOGLE_CLOUD_LOCATION=us-central1` (optional, default: `us-central1`)
- `GEMINI_MODEL=gemini-2.5-flash` (optional)

Example:

```bash
export USE_VERTEX_AI=true
export GOOGLE_CLOUD_PROJECT=your-project-id
export GOOGLE_CLOUD_LOCATION=us-central1
export GEMINI_MODEL=gemini-2.5-flash
npm start
```

If you use HTTPS locally:

- `USE_HTTPS=true`
- `SSL_KEY_PATH=certs/dev-key.pem`
- `SSL_CERT_PATH=certs/dev-cert.pem`

## API / protocol

### Health checks

- `GET /health` → current mode + model
- `GET /` → accepted message schema

### WebSocket messages

Client → server (text):

```json
{
   "type": "tutor.text",
   "requestId": "req-1",
   "payload": {
      "text": "I goed to school yesterday"
   }
}
```

Client → server (multimodal):

```json
{
   "type": "tutor.multimodal",
   "requestId": "req-2",
   "payload": {
      "text": "Please describe this worksheet and help me answer it",
      "mimeType": "image/png",
      "imageBase64": "<base64-image-bytes>"
   }
}
```

Server → client (success):

```json
{
   "type": "tutor.response",
   "requestId": "req-2",
   "payload": {
      "text": "...",
      "source": "gemini",
      "model": "gemini-2.5-flash"
   },
   "timestamp": "2026-03-04T12:34:56.000Z"
}
```

Server → client (error):

```json
{
   "type": "tutor.error",
   "requestId": null,
   "payload": {
      "message": "Model request failed..."
   },
   "timestamp": "2026-03-04T12:34:56.000Z"
}
```

## Gemini Live Agent Challenge fit

This implementation satisfies key technical requirements:

- Uses Gemini via Google GenAI SDK (`@google/genai`)
- Supports multimodal input handling (image + text)
- Runs with Google Cloud Vertex AI in production mode
- Exposes a reproducible backend service for demo/video submission

## Submission checklist

- Add a frontend (web/mobile) for live interaction and recording
- Deploy backend to Google Cloud (Cloud Run recommended)
- Record <=4 minute demo
- Include architecture diagram in your submission
- Submit on Devpost before the deadline
