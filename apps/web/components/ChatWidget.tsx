"use client";

import React, { useState, useRef, useEffect } from "react";
import { usePathname } from "next/navigation";
import { MessageSquare, X, Send, Sparkles, Calendar, ArrowRight, User, HelpCircle } from "lucide-react";
import { sendChatMessage } from "@/lib/api";

interface Message {
  id: string;
  sender: "user" | "system";
  text: string;
  category?: string;
  shiftDetails?: {
    employee_name: string;
    date_str: string;
    shift_type: string;
    start_time: string;
    end_time: string;
    is_unbooked: boolean;
    group_name: string;
    label: string;
  } | null;
}

export function ChatWidget() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  
  const isGeneric = pathname === "/" || pathname === "/om-oss" || pathname === "/integritetspolicy" || pathname === "/cookiepolicy" || pathname === "/login";
  
  const welcomeText = isGeneric
    ? "Hej! Jag är din Sintari-assistent. 🌟\n\nJag kan svara på allmänna frågor om Sintari, vår schemamotor eller hur vi skyddar känslig data. Vad vill du veta?"
    : "Hej! Jag är din Sintari-assistent för Töreboda Schema. 🌟\n\nJag kan svara på praktiska frågor om hur du navigerar i systemet samt visa arbetspass. Vad vill du veta?";

  const quickActions = isGeneric
    ? [
        { label: "Hur fungerar schemamotorn? ⚙️", query: "Hur fungerar Sintaris schemamotor?" },
        { label: "Hur skyddas medarbetardata? 🔒", query: "Hur skyddas vår personliga data hos Sintari?" },
        { label: "Går det att integrera systemet? 🔄", query: "Stödjer systemet integration med andra personal- och WFM-system?" },
      ]
    : [
        { label: "När jobbar jag? 📅", query: "När jobbar jag den 25e maj?" },
        { label: "Hur önskar jag ledigt? ✍️", query: "Hur lägger jag in ett önskemål?" },
        { label: "Hitta timsaldo 📊", query: "Var ser jag mitt timsaldo?" },
      ];

  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(false);
  
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Initiera/uppdatera välkomstmeddelande när kontexten ändras (t.ex. vid inloggning)
  useEffect(() => {
    setMessages([
      {
        id: "welcome",
        sender: "system",
        text: welcomeText,
        category: "general"
      }
    ]);
  }, [isGeneric, welcomeText]);

  // Smart scroll: scrolla så att toppen av långa svar syns, eller till botten annars
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const messageElements = container.querySelectorAll(".message-bubble-wrapper");
    if (messageElements.length === 0) return;

    const lastElement = messageElements[messageElements.length - 1] as HTMLElement;
    const lastMessage = messages[messages.length - 1];

    if (lastMessage?.sender === "system") {
      // Om det är ett svar från assistenten, scrolla till toppen av just det svaret med 12px marginal
      setTimeout(() => {
        container.scrollTo({
          top: lastElement.offsetTop - 12,
          behavior: "smooth"
        });
      }, 80);
    } else {
      // Annars scrolla hela vägen ner (t.ex. när användaren skriver)
      setTimeout(() => {
        container.scrollTo({
          top: container.scrollHeight,
          behavior: "smooth"
        });
      }, 80);
    }
  }, [messages, loading]);

  const handleSend = async (textToSend: string) => {
    if (!textToSend.trim() || loading) return;

    const userMessageId = `user-${Date.now()}`;
    const newMessages: Message[] = [
      ...messages,
      { id: userMessageId, sender: "user", text: textToSend }
    ];
    setMessages(newMessages);
    setInputText("");
    setLoading(true);

    try {
      const result = await sendChatMessage(textToSend);
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          sender: "system",
          text: result.response,
          category: result.category,
          shiftDetails: result.shift_details
        }
      ]);
    } catch (e: unknown) {
      setMessages((prev) => [
        ...prev,
        {
          id: `system-${Date.now()}`,
          sender: "system",
          text: e instanceof Error ? e.message : "Ett fel uppstod vid kommunikation med assistenten.",
          category: "error"
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickAction = (question: string) => {
    handleSend(question);
  };

  const parseItalics = (text: string): React.ReactNode[] => {
    const parts = text.split(/(\*.*?\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith("*") && part.endsWith("*")) {
        return <em key={idx} className="italic text-slate-700 dark:text-slate-350">{part.slice(1, -1)}</em>;
      }
      return part;
    });
  };

  // Render parsed segments with newlines and markdown-like format (**bold**, *italic*, bullet points)
  const renderMessageText = (text: string) => {
    const lines = text.split("\n");
    return lines.map((line, lineIdx) => {
      const isBullet = line.trim().startsWith("•") || line.trim().startsWith("-");
      let cleanLine = line;
      if (isBullet) {
        cleanLine = line.trim().replace(/^[•-]\s*/, "");
      }
      
      const parts = cleanLine.split(/(\*\*.*?\*\*)/g);
      const parsedLine = parts.map((part, partIdx) => {
        if (part.startsWith("**") && part.endsWith("**")) {
          const boldText = part.slice(2, -2);
          return <strong key={partIdx} className="font-bold text-slate-950 dark:text-white">{parseItalics(boldText)}</strong>;
        }
        return <React.Fragment key={partIdx}>{parseItalics(part)}</React.Fragment>;
      });

      if (isBullet) {
        return (
          <div key={lineIdx} className="flex items-start gap-1.5 ml-2 mt-0.5">
            <span className="text-[#D95D39] shrink-0 mt-0.5 font-bold">•</span>
            <span className="flex-1 text-slate-800 dark:text-slate-200">{parsedLine}</span>
          </div>
        );
      }

      return (
        <span key={lineIdx} className="block min-h-[0.5rem]">
          {parsedLine}
        </span>
      );
    });
  };

  return (
    <div className="fixed bottom-5 right-5 z-[9999] font-sans">
      {/* Floating Button with clay/terracotta color [#D95D39] and hover ring */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="relative flex items-center justify-center w-14 h-14 rounded-full bg-[#D95D39] hover:bg-[#C24D2C] text-white shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105 active:scale-95 group focus:outline-none focus:ring-4 focus:ring-[#D95D39]/30"
          aria-label="Öppna schemaassistent"
        >
          {/* Pulse ring */}
          <span className="absolute animate-ping inline-flex h-full w-full rounded-full bg-[#D95D39] opacity-40"></span>
          <MessageSquare className="w-6 h-6 transition-transform group-hover:rotate-6" />
        </button>
      )}

      {/* Chat Window with Glass & Steel design */}
      {isOpen && (
        <div className="flex flex-col w-[350px] sm:w-[380px] h-[520px] rounded-2xl border border-[#7E8F7A]/40 bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl shadow-2xl overflow-hidden transition-all duration-300 ease-in-out transform scale-100 origin-bottom-right">
          {/* Header */}
          <div className="flex items-center justify-between p-4 bg-[#7E8F7A]/10 border-b border-[#7E8F7A]/20">
            <div className="flex items-center gap-2">
              <div className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#D95D39] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-[#D95D39]"></span>
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                  Sintari Assistent
                  <Sparkles size={12} className="text-[#D95D39]" />
                </h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400">Schema & Systemguide</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X size={16} />
            </button>
          </div>

          {/* Messages stream */}
          <div 
            ref={scrollContainerRef}
            className="flex-1 p-4 overflow-y-auto space-y-4 scrollbar-thin relative"
          >
            {messages.map((msg) => (
              <div 
                key={msg.id} 
                className={`message-bubble-wrapper flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                <div className="max-w-[85%] space-y-2">
                  {/* Avatar & Label */}
                  {msg.sender === "system" && (
                    <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 ml-1.5 flex items-center gap-0.5">
                      <Sparkles size={8} /> Assistent
                    </span>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`text-xs md:text-sm p-3 rounded-2xl leading-relaxed transition-all duration-150 ${
                      msg.sender === "user"
                        ? "bg-[#D95D39] text-white rounded-tr-none shadow-sm shadow-[#D95D39]/20"
                        : "bg-slate-50 dark:bg-slate-950/40 text-slate-800 dark:text-slate-200 border border-slate-200/50 dark:border-slate-800/40 rounded-tl-none"
                    }`}
                  >
                    {renderMessageText(msg.text)}
                  </div>

                  {/* Generative UI Skift-kort (Shift Card) */}
                  {msg.sender === "system" && msg.shiftDetails && (
                    <div className="bg-gradient-to-br from-white/80 to-slate-50/50 dark:from-slate-800/60 dark:to-slate-950/30 border border-[#7E8F7A]/30 rounded-xl p-3.5 shadow-md max-w-full space-y-2.5 transition-all duration-300 hover:shadow-lg">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#D95D39] uppercase tracking-wider">
                        <Calendar size={12} />
                        Arbetspass
                      </div>
                      
                      <div className="space-y-1">
                        <h5 className="text-xs font-bold text-slate-800 dark:text-slate-100 flex items-center gap-1">
                          <User size={12} className="text-slate-400" />
                          {msg.shiftDetails.employee_name}
                        </h5>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono">
                          {msg.shiftDetails.date_str}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                        <span className="flex items-center justify-center w-8 h-8 rounded bg-blue-500/10 text-blue-700 dark:text-blue-300 border border-blue-500/20 text-[10px] font-bold">
                          {msg.shiftDetails.shift_type.slice(0, 2).toUpperCase()}
                        </span>
                        <div>
                          <div className="text-xs font-bold text-slate-850 dark:text-slate-150">
                            {msg.shiftDetails.label}
                          </div>
                          <div className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                            Kl. {msg.shiftDetails.start_time} – {msg.shiftDetails.end_time}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between text-[9px] text-slate-400 pt-1.5">
                        <span>Grupp: {msg.shiftDetails.group_name}</span>
                        {msg.shiftDetails.is_unbooked && (
                          <span className="bg-slate-200/50 dark:bg-slate-800 text-[8px] px-1.5 py-0.5 rounded text-slate-500 font-semibold">
                            Deficit
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Typing Loader */}
            {loading && (
              <div className="flex justify-start">
                <div className="space-y-2 max-w-[80%]">
                  <span className="text-[9px] font-semibold text-slate-400 dark:text-slate-500 ml-1.5 flex items-center gap-0.5">
                    <Sparkles size={8} /> Assistent skriver...
                  </span>
                  <div className="bg-slate-100 dark:bg-slate-950/40 p-3 rounded-2xl rounded-tl-none border border-slate-200/50 dark:border-slate-800/40 flex items-center gap-1.5 w-16 justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "0ms" }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "150ms" }}></span>
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: "300ms" }}></span>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Quick Actions (Floating above input) */}
          <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/10 flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
            {quickActions.map((action, idx) => (
              <button
                key={idx}
                onClick={() => handleQuickAction(action.query)}
                className="text-[10px] px-2 py-1 rounded bg-white dark:bg-slate-850 hover:bg-slate-100 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:text-slate-800 transition-colors shadow-2xs font-medium cursor-pointer"
              >
                {action.label}
              </button>
            ))}
          </div>

          {/* Input field */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(inputText);
            }}
            className="p-3 border-t border-[#7E8F7A]/20 flex items-center gap-2 bg-white dark:bg-slate-900"
          >
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Skriv din fråga här..."
              disabled={loading}
              className="flex-1 text-xs md:text-sm pl-3 pr-2 py-2 bg-slate-50 dark:bg-slate-950/20 border border-[#7E8F7A]/30 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#D95D39] focus:border-[#D95D39] text-slate-800 dark:text-slate-100 transition-all placeholder-slate-400 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={!inputText.trim() || loading}
              className="flex items-center justify-center w-8 h-8 rounded-xl bg-[#D95D39] hover:bg-[#C24D2C] disabled:bg-slate-200 disabled:text-slate-400 dark:disabled:bg-slate-800 dark:disabled:text-slate-650 text-white shadow-md hover:shadow-lg disabled:shadow-none transition-all cursor-pointer"
            >
              <Send size={14} className="transform translate-x-[0.5px]" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
