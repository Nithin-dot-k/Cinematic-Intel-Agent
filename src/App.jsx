/**
 * App.jsx
 * This is the main file for our "Cinematic Intel Agent".
 * I have rewritten this in pure JavaScript with detailed comments 
 * to make it easy for you to follow based on your JS knowledge.
 */

import { useState, useRef, useEffect } from 'react';
import { GoogleGenAI, Type } from "@google/genai";
import { motion, AnimatePresence } from "motion/react";
import { 
  Send, 
  Bot, 
  User, 
  Database, 
  Search, 
  Film, 
  Award, 
  TrendingUp,
  Cpu,
  ChevronRight,
  Loader2
} from "lucide-react";
import { MOVIES } from './data/movies';

// --- INITIALIZATION ---
// We initialize the AI Brain using your API Key.
// Locally (Vite), we use import.meta.env.VITE_GEMINI_API_KEY.
// In this preview environment, we use process.env.GEMINI_API_KEY.
const API_KEY = import.meta.env.VITE_GEMINI_API_KEY || process.env.GEMINI_API_KEY;
const ai = new GoogleGenAI({ apiKey: API_KEY });

// --- TOOL DEFINITIONS ---
// These are the "Blueprints" or "Manuals" we send to the AI Brain.
// It explains WHAT each tool does so the AI can choose the right one.

const searchMoviesTool = {
  name: "search_movies",
  description: "Search the movie database by title, director, or genre. Returns a list of matching movies.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      query: {
        type: Type.STRING,
        description: "The search terminology (e.g. 'Nolan', 'Sci-Fi', 'Tamil')"
      }
    },
    required: ["query"]
  }
};

const getTopRatedMoviesTool = {
  name: "get_top_rated",
  description: "Get a list of the highest rated movies in the database.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      limit: {
        type: Type.NUMBER,
        description: "Number of movies to return (default 5)"
      }
    }
  }
};

const getFinancialSummaryTool = {
  name: "get_financial_summary",
  description: "Calculate total budget and revenue for a specific set of movies by their IDs.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      movieIds: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: "List of Movie IDs (e.g. ['MOV001', 'MOV002'])"
      }
    },
    required: ["movieIds"]
  }
};

// --- MAIN COMPONENT ---
export default function App() {
  // State variables (like buckets to hold our data)
  const [messages, setMessages] = useState([]); // Holds our chat history
  const [input, setInput] = useState(''); // Holds what you are currently typing
  const [isTyping, setIsTyping] = useState(false); // Controls the "Thinking" animation
  const scrollRef = useRef(null); // Helps us auto-scroll the chat

  // This function makes sure we always see the latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  /**
   * handleSend: The most important function.
   * This is the "Engine" that manages the Agent Loop.
   */
  const handleSend = async () => {
    if (!input.trim() || isTyping) return; // Don't do anything if input is empty or AI is busy

    // 1. Create the User's Message object
    const userMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input
    };

    // 2. Add it to our chat screen
    setMessages(prev => [...prev, userMessage]);
    setInput(''); // Clear the input box
    setIsTyping(true); // Start the "Thinking" animation

    try {
      // These will store the "Reasoning" we show on screen
      let currentThoughts = ["Analyzing user intent..."];
      let currentToolCalls = [];
      let foundMovies = [];
      
      let iterations = 0;
      const MAX_ITERATIONS = 3; // Prevent infinite loops

      // We map our messages to the format Gemini expects (user vs model)
      const mappedHistory = messages.map(m => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

      // The current conversation context
      let currentContents = [
        ...mappedHistory,
        { role: 'user', parts: [{ text: input }] }
      ];

      let isFinished = false;
      let finalContent = "";

      // --- THE AGENT LOOP ---
      // The AI Brain can call tools multiple times until it has the answer.
      while (!isFinished && iterations < MAX_ITERATIONS) {
        iterations++;
        
        // Ask the Cloud Brain for a response
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: currentContents,
          config: {
            systemInstruction: "You are the Cinematic Intel Agent. Use tools to search the database. LIST results and RECOMMEND them specifically. If the user asks for Tamil, only show Tamil results.",
            tools: [{ functionDeclarations: [searchMoviesTool, getTopRatedMoviesTool, getFinancialSummaryTool] }]
          }
        });

        const modelContent = response.candidates?.[0]?.content;
        const functionCalls = response.functionCalls; // Check if AI wants to use a tool

        if (functionCalls && modelContent) {
          // The AI decided to use one or more tools
          currentThoughts.push(`Thinking: Step ${iterations} requires data.`);
          
          // Process each tool call the AI requested
          const toolResults = await Promise.all(functionCalls.map(async (call) => {
            currentToolCalls.push(`Action: ${call.name}(${JSON.stringify(call.args)})`);
            
            let resultData = [];
            
            // --- OUR LOCAL SEARCH LOGIC ---
            // This is where your code actually touches the data
            if (call.name === "search_movies") {
              const q = (call.args.query || "").toLowerCase();
              resultData = MOVIES.filter(m => 
                m.Title.toLowerCase().includes(q) || 
                m.Director.toLowerCase().includes(q) || 
                m.Genre.toLowerCase().includes(q) ||
                m.Language.toLowerCase().includes(q)
              );
              foundMovies = [...foundMovies, ...resultData];
            } else if (call.name === "get_top_rated") {
              const limit = call.args.limit || 5;
              resultData = [...MOVIES].sort((a, b) => b.ratings - a.ratings).slice(0, limit);
              foundMovies = [...foundMovies, ...resultData];
            } else if (call.name === "get_financial_summary") {
              const ids = call.args.movieIds || [];
              const selected = MOVIES.filter(m => ids.includes(m.Movie_ID));
              resultData = { 
                count: selected.length,
                totalBudget: selected.reduce((acc, m) => acc + m.Budget, 0),
                totalRevenue: selected.reduce((acc, m) => acc + m.Box_Office, 0)
              };
            }
            
            // Package the data to send back to the Cloud Brain
            return {
              functionResponse: {
                name: call.name,
                response: { results: resultData },
                id: call.id
              }
            };
          }));

          // Add the AI's "Thought" and our "Results" to the conversation context
          currentContents.push(modelContent);
          currentContents.push({ role: 'user', parts: toolResults });
        } else {
          // No tool calls means the AI is ready to give the final answer
          finalContent = response.text || "I've processed the information.";
          isFinished = true;
        }
      }

      // 4. Create the final Assistant Message object
      const assistantMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: finalContent || "I've gathered these results for you.",
        thoughts: currentThoughts,
        toolCalls: currentToolCalls,
        // We filter duplicate movies using a Map
        movies: foundMovies.length > 0 ? Array.from(new Map(foundMovies.map(m => [m.Movie_ID, m])).values()) : undefined
      };

      // 5. Update the chat screen
      setMessages(prev => [...prev, assistantMessage]);

    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'assistant',
        content: "Error: Please check your Internet and API Key."
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  // --- UI RENDERING (HTML) ---
  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1D1D1F] font-sans">
      {/* HEADER SECTION */}
      <header className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-[#E5E5E7] z-10 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-[#1D1D1F] flex items-center justify-center">
            <Cpu className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-semibold text-sm tracking-tight capitalize">CINEMATIC INTEL</h1>
            <p className="text-[10px] text-[#86868B] uppercase tracking-widest font-medium">JAVASCRIPT AGENT</p>
          </div>
        </div>
      </header>

      {/* CHAT DISPLAY SECTION */}
      <main className="pt-24 pb-32 max-w-2xl mx-auto px-6 h-screen flex flex-col">
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto space-y-8 pr-2 scrollbar-hide"
        >
          {/* Default Start Screen */}
          {messages.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6">
              <Bot className="w-12 h-12 text-[#1D1D1F] mb-2" />
              <div className="space-y-2">
                <h2 className="text-3xl font-semibold tracking-tight">I am your Agent.</h2>
                <p className="text-[#86868B]">I use tools to explore the movie database for you.</p>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          <AnimatePresence>
            {messages.map((msg) => (
              <motion.div 
                key={msg.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {/* Agent Icon */}
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-[#F5F5F7] flex-shrink-0 flex items-center justify-center mt-1">
                    <Bot className="w-5 h-5 text-[#1D1D1F]" />
                  </div>
                )}
                
                <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                  {/* Reasoning & Tool Call Log */}
                  {msg.role === 'assistant' && (msg.thoughts || msg.toolCalls) && (
                    <div className="w-full space-y-1 mb-2">
                      {msg.thoughts?.map((t, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] text-[#A1A1A6] font-medium uppercase">
                          <ChevronRight className="w-3 h-3" /> {t}
                        </div>
                      ))}
                      {msg.toolCalls?.map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] text-[#0066CC] font-bold uppercase bg-blue-50 px-2 py-1 rounded">
                          <Database className="w-3 h-3" /> {c}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div className={`p-4 rounded-3xl ${
                    msg.role === 'user' 
                      ? 'bg-[#1D1D1F] text-white rounded-tr-none' 
                      : 'bg-[#F5F5F7] text-[#1D1D1F] rounded-tl-none'
                  }`}>
                    <p className="text-[15px] leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                  </div>

                  {/* Movie Display Cards */}
                  {msg.movies && msg.movies.length > 0 && (
                    <div className="flex gap-4 overflow-x-auto pb-4 w-full scrollbar-hide mt-2">
                      {msg.movies.map((m) => (
                        <div key={m.Movie_ID} className="flex-shrink-0 w-64 p-4 bg-white border border-[#E5E5E7] rounded-3xl space-y-3 shadow-sm">
                          <h4 className="font-semibold text-sm">{m.Title}</h4>
                          <div className="text-[11px] text-[#86868B] space-y-1">
                            <p>Language: <span className="text-[#1D1D1F] font-medium">{m.Language}</span></p>
                            <p>Genre: <span className="text-[#1D1D1F] font-medium">{m.Genre}</span></p>
                            <p>Rating: <span className="text-[#1D1D1F] font-medium">⭐ {m.ratings}</span></p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Thinking Animation */}
          {isTyping && (
            <div className="flex gap-4">
               <div className="w-8 h-8 rounded-full bg-[#F5F5F7] flex-shrink-0 flex items-center justify-center"><Bot className="w-5 h-5" /></div>
               <div className="flex flex-col gap-1">
                 <span className="text-[10px] text-gray-400 font-bold uppercase animate-pulse">Agent Thinking...</span>
               </div>
            </div>
          )}
        </div>

        {/* INPUT SECTION */}
        <div className="fixed bottom-0 left-0 w-full p-6 bg-white border-t border-gray-100">
          <div className="max-w-2xl mx-auto flex gap-2">
            <input 
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Command your agent..."
              className="flex-1 bg-[#F5F5F7] rounded-2xl px-5 py-4 text-sm focus:ring-2 focus:ring-black outline-none"
            />
            <button 
              onClick={handleSend}
              disabled={isTyping || !input.trim()}
              className="w-14 h-14 rounded-2xl bg-black text-white flex items-center justify-center hover:bg-gray-800 disabled:opacity-20"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
