# AcePrep AI — AI-Powered Interview Preparation Platform

A full-stack web application that helps job seekers prepare for technical interviews with AI-generated reports, a mock interview simulator, and a tailored resume builder.

---

## Features

- **AI Interview Report** — Upload your resume and a job description; get a match score, skill gaps, tailored technical + behavioral questions, and a 7-day preparation roadmap.
- **Mock Interview Simulator** — A real-time chat-based mock interview with voice mode. Server-authoritative session state machine with streaming AI responses.
- **Resume Builder** — 3-step interactive modal that selects skills, generates two AI-written summaries, validates skill evidence, and produces a tailored one-page PDF.
- **Public Share Links** — Share your interview report with a unique, togglable public link.
- **Authentication** — JWT-based auth with HTTP-only cookies.

---

## Tech Stack

### Backend
| Layer | Technology |
|-------|-----------|
| Runtime | Node.js + Express 5 |
| Database | MongoDB (Mongoose) |
| AI | Google Gemini 2.5 Flash via `@google/genai` |
| PDF generation | Puppeteer |
| Auth | JWT + bcryptjs |
| Validation | Zod + zod-to-json-schema |

### Frontend
| Layer | Technology |
|-------|-----------|
| Framework | React 19 + Vite |
| Routing | React Router v7 |
| Styling | Vanilla CSS / SCSS |
| HTTP | Axios |
| Toasts | react-hot-toast |
| Voice | Web Speech API (SpeechRecognition + SpeechSynthesis) |

---

## Project Structure

```
Complete Project/
├── Backend/
│   ├── src/
│   │   ├── controllers/      # Express route handlers
│   │   ├── models/           # Mongoose schemas
│   │   ├── routes/           # Express routers
│   │   ├── services/         # AI service (Gemini calls, PDF generation)
│   │   └── middlewares/      # Auth, file upload, error handling
│   ├── server.js
│   ├── .env.example          # ← copy to .env and fill in your values
│   └── package.json
│
└── Frontend/
    ├── src/
    │   ├── features/
    │   │   └── interview/    # All interview-related pages, hooks, and components
    │   └── components/       # Shared UI components
    ├── index.html
    └── package.json
```

---

## Getting Started

### Prerequisites
- Node.js 18+
- A MongoDB Atlas cluster (free tier works)
- A Google Gemini API key ([get one here](https://aistudio.google.com/app/apikey))

### 1. Clone the repo
```bash
git clone https://github.com/GoliRitwik/AcePrep-AI-AI-Powered-Interview-Preparation-Platform.git
cd AcePrep-AI-AI-Powered-Interview-Preparation-Platform
```

### 2. Set up the Backend
```bash
cd Backend
npm install

# Copy the example env file and fill in your values
cp .env.example .env
# Edit .env — set MONGO_URI, JWT_SECRET, GOOGLE_GENAI_API_KEY

npm run dev       # starts on http://localhost:3000
```

### 3. Set up the Frontend
```bash
cd Frontend
npm install
npm run dev       # starts on http://localhost:5173
```

The frontend proxies API calls to `http://localhost:3000` automatically.

---

## Environment Variables

See [`Backend/.env.example`](./Backend/.env.example) for all required variables.

| Variable | Description |
|----------|-------------|
| `MONGO_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret for signing JWTs — use a long random string |
| `GOOGLE_GENAI_API_KEY` | Gemini API key |
| `FRONTEND_URL` | *(optional)* Frontend origin for share link URLs |

---

## License

MIT
