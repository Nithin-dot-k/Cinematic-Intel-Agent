# 🎬 Cinematic Intel Agent (JS Version)

A sophisticated AI Movie Agent built with **React**, **Vite**, and **Google Gemini 2.0**.

Unlike standard RAG-based systems that use similarity matching, this **Agentic Bot** uses **Function Calling** to autonomously interact with a structured database. It reasoning step-by-step to provide accurate movie recommendations, search results, and financial analysis.

## 🚀 Features

- **Autonomous Reasoning**: Uses the Gemini API to decide which tools to call.
- **Function Calling**: Real-time querying of a local movie database via JavaScript tools.
- **Reactive UI**: Built with Framer Motion for smooth apple-style animations.
- **Multilingual Support**: Specifically optimized for Indian Regional content (Tamil, Telugu, Kannada, etc.).

## 🛠️ Tech Stack

- **Frontend**: React 19 + Vite
- **Styling**: Tailwind CSS 4
- **AI Brain**: Google Gemini SDK (@google/genai)
- **Icons**: Lucide-React

## 📦 Local Setup

1. **Clone the repository**:
   git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

   Install dependencies:
   npm install

   Set up your environment:

   Create a .env file in the root directory:
   VITE_GEMINI_API_KEY=your_api_key_here

   Run the app:
   npm run dev

🧠 How it works
This agent is an implementation of Agentic Tool-Use. When a user asks a question, the LLM determines if a tool (like search_movies) is needed, executes the function locally, observes the results, and then formulates a natural language response.
