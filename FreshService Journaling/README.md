# FreshService Ticket Analyzer

A React application for analyzing IT support ticket documentation quality using AI. This tool helps managers review ticket notes and provide feedback to support agents.

## Features

- 📊 Analyze ticket documentation quality
- 🤖 AI-powered analysis using Anthropic's Claude
- 📝 Detailed feedback on strengths and weaknesses
- 🎯 Scoring system (1-10) for documentation quality
- 📧 Email and Slack notification support (coming soon)
- 🎥 Loom video link detection

## Prerequisites

- Node.js 18+ and npm/yarn
- Anthropic API key (for analysis feature)
- FreshService API key (required to fetch real tickets)

## Installation

1. Install dependencies:
```bash
npm install
```

## Running the Application

1. Install dependencies:
```bash
npm install
```

2. Start both the frontend and backend proxy server:
```bash
npm run dev:full
```

Or run them separately in two terminals:
- Terminal 1: `npm run dev` (starts Vite frontend on port 5173)
- Terminal 2: `npm run server` (starts proxy server on port 3001)

3. Open your browser to the URL shown (typically `http://localhost:5173`)

3. Configure your settings:
   - **FreshService Domain** (required - enter just your subdomain like `yourcompany`, or the full domain `yourcompany.freshservice.com`)
   - **FreshService API Key** (required - get from your FreshService profile settings)
   - **Anthropic API Key** (required for analysis feature)
   - Slack Webhook URL (optional)

## Getting an Anthropic API Key

1. Visit https://console.anthropic.com/
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-ant-`)
6. Paste it into the configuration screen

## Usage

1. Click "Save & Continue to Dashboard" after configuring
2. Click "Fetch Tickets" to load resolved tickets from your FreshService account (last 30 days)
3. Click "Analyze Notes" on any ticket to get AI-powered feedback
4. Review the analysis results including:
   - Overall score (1-10)
   - Strengths
   - Areas for improvement
   - Manager summary
   - Agent feedback

## Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Project Structure

```
├── src/
│   ├── FreshServiceAnalyzer.tsx  # Main component
│   ├── App.tsx                    # App wrapper
│   ├── main.tsx                   # Entry point
│   └── index.css                  # Tailwind CSS
├── index.html                     # HTML template
├── package.json                    # Dependencies
├── vite.config.ts                 # Vite configuration
├── tsconfig.json                  # TypeScript config
└── tailwind.config.js             # Tailwind config
```

## Technologies Used

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide React (icons)
- Anthropic API (Claude)

## Getting a FreshService API Key

1. Log in to your FreshService account
2. Go to your profile settings (click your avatar → Profile)
3. Navigate to the API section
4. Generate or copy your API key
5. Paste it into the configuration screen

**Note:** Make sure you're using API v2 (not v1, which was deprecated). The app automatically uses the v2 endpoint.

## Notes

- Fetches resolved tickets from the last 30 days with private notes
- Only tickets with private notes will be displayed (required for analysis)
- Email and Slack notifications show alerts (not yet fully implemented)
- The app uses Basic Authentication with your API key

## License

MIT

