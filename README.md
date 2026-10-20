# Minelot Enterprise

## The AI Decision Layer for Mining

A full-stack platform that connects fragmented mining data and uses conversational AI to explain operational risks, identify Lean waste, simulate scenarios, and recommend actionable decisions.

---

## Problem

Large mining companies use multiple disconnected systems (ERP, SAP, maintenance, production, HSE, IoT, SCADA, fleet management). A supervisor needing to answer "Why did productivity decrease?" must manually cross multiple data sources.

**Minelot** solves this by creating an AI decision layer that automatically:
- Connects the data
- Retrieves relevant evidence
- Reasons through analytical engines
- Validates conclusions
- Simulates scenarios
- Recommends prioritized actions

---

## Features

✅ **Conversational Interface**: Ask questions in natural language  
✅ **Evidence-Based**: All answers grounded in data  
✅ **Multi-Agent Reasoning**: Specialized agents for risk, Lean, production, maintenance  
✅ **Risk Detection**: Identify and prioritize critical operational risks  
✅ **Lean Waste Analysis**: Detect inefficiencies (waiting, routing, fuel, etc.)  
✅ **What-If Simulation**: Model scenarios and predict outcomes  
✅ **Executive Summaries**: Quick 30-second briefings  
✅ **Multi-Site Support**: Compare across mines  
✅ **Evaluation Framework**: Measure accuracy and grounding  

---

## Quick Start

### Prerequisites
- Python 3.11+
- Node.js 18+
- Docker (optional)

### Option 1: Local Development

**Backend:**
```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host x.x.x.x --port ##
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Then open:
- Frontend: http://localhost:...
- API Docs: http://localhost:.../docs

### Option 2: Docker

```bash
docker-compose up --build
```

---

## Demo Flow (3 minutes)

1. **Home Page** (`/`) - Overview of MineCopilot
2. **Dashboard** (`/dashboard`) - Real-time KPIs and metrics
3. **Copilot** (`/copilot`) - Ask questions:
   - "Why did productivity decrease today?"
   - "What is the most critical risk?"
   - "What should we do next?"
   - "What happens if we reduce waiting time by 15%?"
   - "Give me an executive summary."

---

## Architecture

### ASK → RETRIEVE → REASON → VALIDATE → SIMULATE → RECOMMEND

The system follows a structured workflow:
1. **ASK**: User submits natural language question
2. **RETRIEVE**: Load data and knowledge from databases and documents
3. **REASON**: Analytical engines (risk, Lean, production) process data
4. **VALIDATE**: Cross-check calculations and evidence
5. **SIMULATE**: Model scenarios and predict outcomes
6. **RECOMMEND**: Prioritize actions with estimated ROI

### Tech Stack

**Frontend:**
- React 18 + Next.js 14
- TypeScript
- Tailwind CSS
- Lucide React icons

**Backend:**
- Python 3.11+
- FastAPI
- Pydantic
- Pandas + NumPy
- SQLite/DuckDB

**Data:**
- Synthetic mining datasets (equipment, production, maintenance, safety, fuel, operations)
- RAG knowledge base (procedures, policies, manuals)
- FAISS for embeddings

**Deployment:**
- Docker + Docker Compose
- GitHub Actions (CI/CD ready)

---

## Project Structure

```
factored-hackathon-2026-minelot/
├── backend/                       # FastAPI application
│   ├── app/
│   │   ├── main.py               # Entry point
│   │   ├── config.py             # Configuration
│   │   ├── api/routes/           # API endpoints
│   │   ├── services/             # Business logic
│   │   ├── agents/               # AI agents
│   │   ├── engines/              # Analytics engines
│   │   ├── data/                 # Synthetic datasets
│   │   ├── knowledge/            # RAG knowledge base
│   │   └── tests/                # Unit tests
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/                      # Next.js application
│   ├── app/
│   │   ├── page.tsx              # Home page
│   │   ├── copilot/page.tsx      # Copilot chat interface
│   │   ├── dashboard/page.tsx    # Dashboard
│   │   ├── layout.tsx            # Root layout
│   │   └── globals.css           # Global styles
│   ├── components/               # React components
│   ├── lib/                      # Utilities and types
│   ├── hooks/                    # Custom React hooks
│   ├── package.json
│   └── .env.example
│
├── docs/                         # Documentation
│   ├── ARCHITECTURE.md
│   ├── API.md
│   ├── RAG.md
│   ├── AGENTS.md
│   └── DEMO.md
│
├── evaluation/                   # Evaluation framework
│   ├── questions.json            # 30+ test questions
│   ├── report.py                 # Report generation
│   └── results.json              # Results log
│
├── docker-compose.yml
├── .gitignore
├── .env.example
├── README.md
└── ARCHITECTURE.md
```

Implement the following:

- Deployment readiness: Prepare the frontend for Vercel deployment if compatible with the existing stack.

  Prepare the FastAPI backend for Render deployment if a Python backend exists.
  Add deployment instructions, health checks, environment-variable documentation, and appropriate configuration files.
  Document how to obtain separate frontend and backend public URLs and configure CORS safely.
  RocketRide

  Evaluate whether it can add value to the existing AI pipeline.
  If credentials and documentation are available, implement an optional adapter behind a feature flag.
  Preserve a working fallback if RocketRide is not configured.

- PromptQL: Evaluate integration for natural-language queries over authorized structured operational data. Do not assume a public API or invent endpoints. Implement only against verified official documentation and available credentials.

- Snyk: Add an optional security workflow to scan project dependencies and source code. Use official supported actions and document setup. Do not commit tokens or secrets.

- CelestoAI: Evaluate its official SDK for isolated agent execution or related useful workflows. Implement an optional adapter only if compatible with the current architecture. Never execute untrusted code on the production host.

Configuration

Update .env.example with documented placeholder variables for optional integrations.

Never place actual API keys in source code, frontend variables, logs, or commits.

Make missing optional integrations fail gracefully.

Documentation

Update README.md with the architecture, integration status, setup instructions, deployment steps, Live URL placeholders, and a clear distinction between implemented, optional, and not-yet-configured features.

Add tests for configuration and integration fallbacks.

Validation

Run existing tests and build checks.

Fix regressions.

Report the exact files changed, commands executed, remaining setup steps, and any credentials or external accounts required.
---

## API Endpoints

### Health
- `GET /health` - Health check

### Dashboard
- `GET /api/dashboard/summary` - Operational summary
- `GET /api/dashboard/risks` - Risk evaluation
- `GET /api/dashboard/lean` - Lean waste analysis
- `GET /api/dashboard/recommendations` - Recommended actions
- `GET /api/dashboard/equipment` - Equipment status

### Chat / Copilot
- `POST /api/chat/ask` - Ask MineCopilot (request/response)

### Analysis
- `POST /api/analysis/risk-score` - Risk calculation
- `POST /api/analysis/lean-waste` - Lean waste detection
- `POST /api/analysis/simulate` - What-if scenarios

### RAG
- `POST /api/rag/search` - Search knowledge base
- `POST /api/rag/ingest` - Ingest documents

---

## Key Metrics Explained

### Risk Score (0-100)
- **0-30**: LOW risk
- **31-60**: MEDIUM risk
- **61-80**: HIGH risk
- **81-100**: CRITICAL risk

Calculated as: `Probability × Severity × Exposure`

### Lean Waste Score (0-100)
Detects waste categories:
1. Waiting (queue times)
2. Transportation (routing inefficiency)
3. Motion (equipment idle time)
4. Overprocessing
5. Inventory
6. Defects
7. Overproduction
8. Unused talent
9. Energy/fuel waste

### Productivity Delta (%)
Comparison of actual vs. target production:
- Negative: Production below target
- Positive: Production above target

### Equipment Availability (%)
Fleet uptime: Operating hours / Total available hours

---

## Development

### Running Tests

**Backend:**
```bash
cd backend
pytest tests/ -v
```

**Frontend:**
```bash
cd frontend
npm test
```

### Adding New Agents

1. Create `backend/app/agents/my_agent.py`
2. Extend `BaseAgent` class
3. Register in `llm_service.py`

### Adding New Data Sources

1. Add CSV to `backend/data/`
2. Create loader in `backend/app/data/loaders.py`
3. Update `DataService` to load the new data

---

## Demo Scenario

**Setup:** Site A's productivity dropped 8.4% today.

**User asks:** "Why did productivity decrease?"

**Minelot responds:**
- Identifies waiting time increase (+31%)
- Equipment availability decrease (-7%)
- Route deviation increase (+12%)
- Maintenance backlog on critical equipment

**User asks:** "What should we do?"

**Minelot recommends:**
- Prioritize T-24 maintenance
- Reduce F2 waiting time
- Optimize haul routes

**User asks:** "What happens if we reduce waiting time by 15%?"

**Minelot simulates:**
- Productivity: +4.9%
- Fuel consumption: -6.7%
- Downtime risk: -12%
- Estimated savings: $126K/year

---

<img width="990" height="522" alt="image" src="https://github.com/user-attachments/assets/202818c1-b63b-41a7-831e-c38837b4fe10" />

---
## Evaluation Framework

30+ test questions covering:
- Factual accuracy
- Root cause analysis
- Risk detection
- Lean waste identification
- What-if simulation
- Cross-site comparison
- Evidence retrieval

Run evaluation:
```bash
cd backend
python evaluation/report.py
```

---

## Disclaimer

This prototype is for demonstration and decision support only. It does not replace qualified mining, safety, or engineering judgment. All recommendations should be reviewed by qualified professionals before implementation.

---

## Team

Hackathon Team — Minelot Enterprise 2026
Benjamin Ghinno - FIIS UNI - PERU
Valeria Villacorta  - FIIS UNI - PERU

**Roles:**

Benjamin Ghinno IA + ML + DATA engineer

Valeria Villacorta Machine Learning + Logistic + Mine

---

## License

MIT

---

## Roadmap

- [ ] Multi-site comparison and benchmarking
- [ ] Advanced RAG with semantic search
- [ ] Custom agent training
- [ ] Mobile app (React Native)
- [ ] Real-time alerting system
- [ ] Integration with mining equipment APIs
- [ ] Advanced ML models for prediction
- [ ] Blockchain for audit trail
- [ ] Multi-language support
- [ ] On-premise deployment options

---

For detailed architecture, see [ARCHITECTURE.md](./ARCHITECTURE.md)
