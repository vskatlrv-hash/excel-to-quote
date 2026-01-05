# Excel-to-Quote Copilot 🤖

> **Your AI Sales Engineering Assistant** — Upload any Excel BOM and let the AI analyze, map columns, detect risks, and help you build better quotes.

![Next.js](https://img.shields.io/badge/Next.js-14-black?style=flat-square&logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square&logo=typescript)
![Vercel AI SDK](https://img.shields.io/badge/AI_SDK-Vercel-purple?style=flat-square)

---

## 🎯 What This Tool Does

The Excel-to-Quote Copilot combines **automated data processing** with an **AI-powered assistant** to transform complex Excel BOMs into actionable quote insights.

### Core Capabilities

| Feature | Description |
|---------|-------------|
| **🧠 AI Column Mapping** | Automatically identifies part numbers, quantities, descriptions, and pricing columns — regardless of format or naming conventions |
| **🛡️ Risk Detection** | Scans for Incoterms (EXW, DDP, etc.), Liquidated Damages clauses, and data quality issues |
| **💬 AI Copilot Assistant** | Ask questions about your data, get negotiation recommendations, and receive risk explanations |
| **📊 Instant Parsing** | Upload any .xlsx, .xls, or .csv file and get structured data in seconds |
| **🔒 Zero Data Retention** | Enterprise-grade security — all processing happens in-memory, no files stored |

---

## 🤖 What the AI Can Do

The AI Copilot is **always visible** on the right side of the screen, ready to help. Here's what you can ask:

### Before Uploading a File
- "What can you help me with?"
- "How do I analyze a BOM?"
- "What risks do you detect?"
- "Tell me about Incoterms"

### After Uploading a File
- **"Explain the detected risks"** — Get detailed breakdowns of Incoterms, LD clauses, and data issues
- **"What should I negotiate?"** — Receive strategic recommendations based on risk findings
- **"Summarize this quote"** — Get a high-level overview of line items, quantities, and pricing
- **"Any red flags I should know?"** — Quick identification of critical issues needing attention
- **"How do I handle DDP terms?"** — Learn about specific commercial terms and their implications

### Example Conversation
```
You: Explain the Incoterms risks
AI:  I found 3 Incoterms in your quote:
     • DDP (Row 15) - CRITICAL: You're responsible for all duties, taxes, and 
       delivery to the customer's door. Budget 15-25% for import costs.
     • CIF (Rows 8, 22) - MEDIUM: You cover insurance and freight to port.
     • EXW (Row 3) - LOW: Buyer handles all shipping.
     
     Recommendation: Negotiate rows with DDP to CIF or FOB to reduce liability.
```

---

## 🏗️ Technology Stack

| Component | Technology |
|-----------|------------|
| **Framework** | Next.js 14 (App Router) |
| **Language** | TypeScript |
| **AI Integration** | Vercel AI SDK |
| **LLM Provider** | Google Gemini / OpenAI GPT-4 |
| **Excel Parsing** | SheetJS (xlsx) |
| **Validation** | Zod |

---

## 🚀 Getting Started

### Prerequisites

- Node.js 18.17 or later
- npm, yarn, or pnpm
- OpenAI API key (for AI features)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/yourusername/excel-to-quote.git
   cd excel-to-quote
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Set up environment variables:**
   Create a `.env.local` file in the root directory:
   ```env
   OPENAI_API_KEY=sk-your-api-key-here
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open [http://localhost:3000](http://localhost:3000)** in your browser.

---

## 📁 Project Structure

```
excel-to-quote/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   └── chat/             # AI chat endpoint
│   │   ├── actions/
│   │   │   └── processExcel.ts   # Server Action for file processing
│   │   ├── globals.css           # Split-panel layout & design system
│   │   ├── layout.tsx            # Root layout with fonts
│   │   └── page.tsx              # Main app (split-panel layout)
│   ├── components/
│   │   ├── AICopilot.tsx         # AI assistant panel (right side)
│   │   ├── FileUpload.tsx        # Drag-and-drop file upload
│   │   ├── ResultsTable.tsx      # Parsed data display
│   │   ├── RiskPanel.tsx         # Risk assessment visualization
│   │   └── ExportButtons.tsx     # CSV/JSON export functionality
│   ├── lib/
│   │   ├── excelParser.ts        # SheetJS wrapper functions
│   │   ├── riskDetector.ts       # Risk detection algorithms
│   │   └── schemas.ts            # Zod schemas for AI outputs
│   └── types/
│       └── quote.ts              # TypeScript type definitions
└── package.json
```

---

## 🎨 UI / Layout

The app uses a **split-panel design** with the AI Copilot always visible:

```
┌────────────────────────────────────────────────────────────────┐
│                        │                                       │
│   📄 Upload Zone       │         🤖 AI COPILOT                 │
│                        │                                       │
│   ─────────────────    │     "Your AI Sales Engineering        │
│                        │      Assistant"                       │
│   📊 Results Table     │                                       │
│   (Parsed BOM Data)    │     [Risk Analysis]                   │
│                        │     [Negotiation Tips]                │
│   ─────────────────    │     [Data Insights]                   │
│                        │                                       │
│   🛡️ Risk Panel       │     ─────────────────────              │
│   (Detected Issues)    │                                       │
│                        │     💬 Ask anything...                │
│                        │                                       │
└────────────────────────────────────────────────────────────────┘
        Left Panel                    Right Panel (Fixed)
```

### Design Features
- **Dark mode** with glassmorphism effects
- **Gradient accents** and smooth animations
- **Responsive layout** — stacks on mobile
- **Premium feel** — subtle glows and micro-interactions

---

## 🛡️ Risk Detection

The Copilot automatically scans for:

### Incoterms
| Term | Risk Level | Implication |
|------|------------|-------------|
| EXW, FCA | 🟢 Low | Buyer handles shipping |
| FOB, CIF, CFR | 🟡 Medium | Seller covers freight/insurance |
| CIP, DAP, DPU | 🟠 High | Seller responsible to destination |
| DDP | 🔴 **Critical** | Seller handles all duties & taxes |

### Liquidated Damages
- Detects penalty clauses for late delivery
- Extracts percentage rates and caps
- Flags high-risk terms for Deal Desk review

### Data Quality
- Duplicate part numbers
- Unit of Measure conflicts
- Missing critical fields (part number, quantity)

---

## 🔒 Security Architecture

**Zero Data Retention** — Your files are never stored:

1. Files are uploaded as FormData
2. Converted to ArrayBuffer in memory
3. Parsed with SheetJS (no disk writes)
4. Processed and garbage collected

**No files are ever written to disk or external storage.**

---

## 📊 Usage Workflow

1. **Upload** — Drag and drop an Excel file (.xlsx, .xls, .csv)
2. **Analyze** — AI maps columns and detects risks automatically
3. **Ask** — Use the AI Copilot to understand risks and get recommendations
4. **Export** — Download parsed data as CSV or JSON

---

## 📝 License

This project is for internal use.

---

## 🤝 Contributing

Contributions are welcome! Please open an issue or submit a pull request.
