flowchart LR
    U[Mobile User] --> A[Smartphone App or Web Client]
    A -->|WSS tutor.text / tutor.multimodal| CR[Cloud Run\nAI Language Tutor Node.js]

    subgraph Firebase
      FH[Firebase Hosting\nWeb App Delivery]
      FA[Firebase Auth\nUser Identity]
      FS[Cloud Firestore\nSession Data and Progress]
    end

    A --> FH
    A --> FA
    CR -->|Read/Write progress| FS

    CR -->|Google GenAI SDK| V[Vertex AI Gemini 2.5 Flash]
    V --> CR
    CR -->|tutor.response / tutor.error| A

    CR --> L[(Cloud Logging & Monitoring)]