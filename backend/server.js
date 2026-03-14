import "dotenv/config";
import express from "express";
import https from "https";
import fs from "fs";
import { WebSocketServer } from "ws";
import { GoogleGenAI } from "@google/genai";

const app = express();
const port = Number(process.env.PORT) || 8080;
const useVertexAi = process.env.USE_VERTEX_AI === "true";
const useHttps = process.env.USE_HTTPS === "true";
const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;
const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";

let ai = null;
if (useVertexAi) {
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || "us-central1";

  if (!project) {
    console.error(
      "USE_VERTEX_AI is true but GOOGLE_CLOUD_PROJECT is missing."
    );
    process.exit(1);
  }

  ai = new GoogleGenAI({
    vertexai: true,
    project,
    location,
  });
}

function safeParseJson(text) {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function normalizeIncomingMessage(rawText) {
  const parsed = safeParseJson(rawText);
  if (!parsed) {
    return {
      type: "tutor.text",
      requestId: null,
      payload: {
        text: rawText,
      },
    };
  }

  return {
    type: parsed.type || "tutor.text",
    requestId: parsed.requestId || null,
    payload: parsed.payload || {},
  };
}

function toOutboundMessage({ type, requestId, payload }) {
  return JSON.stringify({
    type,
    requestId: requestId || null,
    payload,
    timestamp: new Date().toISOString(),
  });
}

function generateLocalTutorResponse(payload, messageType) {
  const text = (payload?.text || "").trim();
  const hasImage = Boolean(payload?.imageBase64);

  if (!text && !hasImage) {
    return [
      "[Local tutor mode — no AI credits used]",
      "Send text, or send text + image for multimodal tutoring.",
      "Example task: 'Fix my grammar and explain in simple terms.'",
    ].join("\n");
  }

  if (messageType === "tutor.multimodal" && hasImage) {
    return [
      "[Local tutor mode — multimodal placeholder]",
      text
        ? `You asked: \"${text}\"`
        : "You sent an image without extra text.",
      "I can confirm your client sent an image payload. Enable Vertex AI mode for real image understanding.",
    ].join("\n");
  }

  return [
    "[Local tutor mode — no AI credits used]",
    `You said: \"${text}\"`,
    "Feedback: check article usage (a/an/the) and verb tense consistency.",
    "Try this exercise: rewrite your sentence in past tense and ask one follow-up question.",
  ].join("\n");
}

function buildGeminiContents(type, payload) {
  const text = (payload?.text || "").trim();
  const prompt = text || "Please analyze the provided input and tutor the user.";

  if (type === "tutor.multimodal" && payload?.imageBase64 && payload?.mimeType) {
    return [
      {
        role: "user",
        parts: [
          {
            text:
              "You are a multimodal language tutor. First, answer the user's request about the image content directly (identify objects/scenes, mention uncertainty if needed). Then give a short language improvement section with: (1) corrected user sentence, (2) one-line explanation, (3) one short exercise.\n\nUser request:\n" +
              prompt,
          },
          {
            inlineData: {
              mimeType: payload.mimeType,
              data: payload.imageBase64,
            },
          },
        ],
      },
    ];
  }

  return [
    {
      role: "user",
      parts: [
        {
          text:
            "You are a concise, friendly language tutor. Answer user intent first, then correct mistakes, explain briefly, then give one practical exercise.\n\nUser text:\n" +
            prompt,
        },
      ],
    },
  ];
}

function looksLikeVisualQuestion(text) {
  return /what\s+is\s+this|what'?s\s+this|what\s+is\s+that|identify\s+this|what\s+am\s+i\s+showing/i.test(
    text || ""
  );
}

let server;

if (useHttps) {
  if (!sslKeyPath || !sslCertPath) {
    console.error(
      "USE_HTTPS is true but SSL_KEY_PATH or SSL_CERT_PATH is missing."
    );
    process.exit(1);
  }

  let key;
  let cert;

  try {
    key = fs.readFileSync(sslKeyPath);
    cert = fs.readFileSync(sslCertPath);
  } catch (error) {
    console.error("Failed to read SSL certificate files:", error);
    process.exit(1);
  }

  server = https.createServer({ key, cert }, app).listen(port, () => {
    console.log("Server running with HTTPS/WSS on port", port);
    console.log("WebSocket protocol: wss");
    console.log(
      useVertexAi
        ? "AI mode: Vertex AI enabled"
        : "AI mode: local mock (no cloud usage)"
    );
  });
} else {
  server = app.listen(port, () => {
    console.log("Server running with HTTP/WS on port", port);
    console.log("WebSocket protocol: ws");
    console.log(
      useVertexAi
        ? "AI mode: Vertex AI enabled"
        : "AI mode: local mock (no cloud usage)"
    );
  });
}

app.get("/health", (_req, res) => {
  res.json({
    ok: true,
    mode: useVertexAi ? "vertex-ai" : "local",
    https: useHttps,
    model: modelName,
  });
});

app.get("/", (_req, res) => {
  res.json({
    name: "AI Language Tutor Agent",
    websocketPath: "/",
    acceptedMessages: [
      {
        type: "tutor.text",
        payload: { text: "string" },
      },
      {
        type: "tutor.multimodal",
        payload: {
          text: "string",
          imageBase64: "base64-encoded image bytes",
          mimeType: "image/png | image/jpeg | image/webp",
        },
      },
    ],
  });
});

const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  ws.on("message", async (message) => {
    try {
      const incoming = normalizeIncomingMessage(message.toString());
      const { type, requestId, payload } = incoming;

      if (!useVertexAi || !ai) {
        ws.send(
          toOutboundMessage({
            type: "tutor.response",
            requestId,
            payload: {
              text: generateLocalTutorResponse(payload, type),
              source: "local",
            },
          })
        );
        return;
      }

      if (type === "tutor.text" && looksLikeVisualQuestion(payload?.text || "")) {
        ws.send(
          toOutboundMessage({
            type: "tutor.error",
            requestId,
            payload: {
              message:
                "This looks like a visual question. Send type='tutor.multimodal' with payload.imageBase64 and payload.mimeType so Gemini can see the image.",
            },
          })
        );
        return;
      }

      if (type === "tutor.multimodal" && !payload?.imageBase64) {
        ws.send(
          toOutboundMessage({
            type: "tutor.error",
            requestId,
            payload: {
              message:
                "Multimodal request requires payload.imageBase64. Capture a camera frame first.",
            },
          })
        );
        return;
      }

      if (
        type === "tutor.multimodal" &&
        payload?.imageBase64 &&
        !payload?.mimeType
      ) {
        ws.send(
          toOutboundMessage({
            type: "tutor.error",
            requestId,
            payload: {
              message:
                "For multimodal requests, provide payload.mimeType (for example image/png).",
            },
          })
        );
        return;
      }

      const contents = buildGeminiContents(type, payload);

      const result = await ai.models.generateContent({
        model: modelName,
        contents,
      });

      const response = result.text || "No response from model.";

      ws.send(
        toOutboundMessage({
          type: "tutor.response",
          requestId,
          payload: {
            text: response,
            source: "gemini",
            model: modelName,
          },
        })
      );
    } catch (error) {
      console.error("Gemini request failed:", error);
      ws.send(
        toOutboundMessage({
          type: "tutor.error",
          requestId: null,
          payload: {
            message:
              "Model request failed. Verify GOOGLE_CLOUD_PROJECT and Google Cloud credentials (ADC), or disable cloud mode by setting USE_VERTEX_AI=false.",
          },
        })
      );
    }
  });
});
