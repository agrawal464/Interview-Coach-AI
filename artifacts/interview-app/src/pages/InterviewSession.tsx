import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Mic, MicOff, ChevronRight, ArrowLeft, BrainCircuit, Loader2, Volume2, Code, Plus, X } from "lucide-react";
import {
  useCreateInterview,
  useUpdateInterview,
  useGenerateFeedback,
  getListInterviewsQueryKey,
  getGetInterviewStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const STATIC_QUESTIONS: Record<string, { questions: string[]; duration: string; label: string }> = {
  hr: {
    label: "HR Interview",
    duration: "~15 min",
    questions: [
      "Tell me about yourself.",
      "Why do you want this role?",
      "Describe a conflict situation you faced and how you resolved it.",
      "Where do you see yourself in 5 years?",
      "What are your greatest strengths and weaknesses?",
    ],
  },
  case_study: {
    label: "Case Study Interview",
    duration: "~20 min",
    questions: [
      "How would you increase revenue for a product that is declining in sales?",
      "Estimate the number of smartphones sold in India per year.",
      "How would you prioritize features for a new mobile app launch?",
      "A popular app loses 30% of its users in one month. How do you diagnose and fix this?",
      "You are the PM for a ride-sharing app. How do you grow the driver supply?",
    ],
  },
};

const TECH_STACK_SUGGESTIONS = [
  "React", "Node.js", "Python", "Java", "TypeScript",
  "PostgreSQL", "MongoDB", "AWS", "Docker", "GraphQL",
  "Vue.js", "Django", "Spring Boot", "Kubernetes", "Redis",
];

type Phase = "rules" | "tech-stack" | "interview" | "generating";

interface ISpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((e: any) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

interface ISpeechRecognitionConstructor {
  new (): ISpeechRecognition;
}

declare global {
  interface Window {
    SpeechRecognition: ISpeechRecognitionConstructor;
    webkitSpeechRecognition: ISpeechRecognitionConstructor;
  }
}

export default function InterviewSession() {
  const params = useParams<{ type: string }>();
  const interviewType = params.type ?? "hr";
  const isTechnical = interviewType === "technical";

  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("rules");
  const [techStackInput, setTechStackInput] = useState("");
  const [selectedTech, setSelectedTech] = useState<string[]>([]);
  const [serverQuestions, setServerQuestions] = useState<string[]>([]);
  const [interviewId, setInterviewId] = useState<number | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);

  const config = isTechnical
    ? { label: "Technical Interview", duration: "~20 min", questions: serverQuestions }
    : STATIC_QUESTIONS[interviewType] ?? STATIC_QUESTIONS.hr;

  const createInterview = useCreateInterview();
  const updateInterview = useUpdateInterview();
  const generateFeedback = useGenerateFeedback();

  const speakText = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) { startListening(); return; }
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.9;
    utt.pitch = 1;
    utt.volume = 1;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => { setIsSpeaking(false); startListening(); };
    utt.onerror = () => { setIsSpeaking(false); startListening(); };
    window.speechSynthesis.speak(utt);
  }, []);

  const startListening = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    try {
      const rec = new SR();
      rec.continuous = true;
      rec.interimResults = true;
      rec.lang = "en-US";
      rec.onresult = (e: any) => {
        let full = "";
        for (let i = 0; i < e.results.length; i++) full += e.results[i][0].transcript;
        setTranscript(full);
      };
      rec.onend = () => setIsRecording(false);
      rec.onerror = () => setIsRecording(false);
      recognitionRef.current = rec;
      rec.start();
      setIsRecording(true);
      setTranscript("");
    } catch { setIsRecording(false); }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  useEffect(() => {
    if (phase === "interview" && config.questions.length > 0) {
      speakText(config.questions[currentQ]);
    }
    return () => { window.speechSynthesis?.cancel(); recognitionRef.current?.stop(); };
  }, [phase, currentQ, serverQuestions]);

  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); recognitionRef.current?.stop(); };
  }, []);

  const addTech = (tech: string) => {
    const t = tech.trim();
    if (t && !selectedTech.includes(t)) setSelectedTech((prev) => [...prev, t]);
    setTechStackInput("");
  };

  const removeTech = (tech: string) => setSelectedTech((prev) => prev.filter((t) => t !== tech));

  const handleStartInterview = (techStack?: string) => {
    createInterview.mutate(
      {
        data: {
          interviewType: interviewType as "hr" | "technical" | "case_study",
          ...(techStack ? { techStack } : {}),
        },
      },
      {
        onSuccess: (session: any) => {
          setInterviewId(session.id);
          if (isTechnical) {
            // Questions are generated server-side; re-fetch them
            fetch(`/api/interviews/${session.id}`, {
              headers: { "Content-Type": "application/json" },
              credentials: "include",
            })
              .then((r) => r.json())
              .then((data: any) => {
                setServerQuestions(data.questions || []);
                setPhase("interview");
              })
              .catch(() => setPhase("interview"));
          } else {
            setPhase("interview");
          }
          setCurrentQ(0);
          setAnswers([]);
          queryClient.invalidateQueries({ queryKey: getListInterviewsQueryKey() });
        },
      }
    );
  };

  const handleNextQuestion = async () => {
    stopListening();
    window.speechSynthesis?.cancel();

    const currentAnswer = transcript.trim() || "(no answer provided)";
    const newAnswers = [...answers, currentAnswer];
    setAnswers(newAnswers);
    setTranscript("");

    if (!interviewId) return;

    const questions = config.questions;

    await updateInterview.mutateAsync({
      id: interviewId,
      data: {
        answers: newAnswers,
        questionsAnswered: newAnswers.length,
        status: newAnswers.length >= questions.length ? "completed" : "in_progress",
      },
    });

    if (newAnswers.length >= questions.length) {
      setPhase("generating");
      generateFeedback.mutate(
        { id: interviewId },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getListInterviewsQueryKey() });
            queryClient.invalidateQueries({ queryKey: getGetInterviewStatsQueryKey() });
            setLocation(`/interview/${interviewId}/results`);
          },
          onError: () => {
            alert("Failed to generate feedback. Please try again.");
            setPhase("interview");
          },
        }
      );
    } else {
      setCurrentQ((q) => q + 1);
    }
  };

  const toggleRecording = () => {
    if (isRecording) stopListening();
    else { window.speechSynthesis?.cancel(); startListening(); }
  };

  const progress = phase === "interview"
    ? ((currentQ) / (config.questions.length || 5)) * 100
    : 0;

  // ── RULES SCREEN ──────────────────────────────────────────────────────────
  if (phase === "rules") {
    const typeConfig = isTechnical
      ? { label: "Technical Interview", duration: "~20 min", iconBg: "bg-accent/15", iconColor: "text-accent" }
      : interviewType === "case_study"
      ? { label: "Case Study Interview", duration: "~20 min", iconBg: "bg-teal-500/15", iconColor: "text-teal-400" }
      : { label: "HR Interview", duration: "~15 min", iconBg: "bg-primary/15", iconColor: "text-primary" };

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <div className="max-w-xl w-full">
          <button
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors"
            onClick={() => setLocation("/dashboard")}
          >
            <ArrowLeft className="w-4 h-4" /> Back to Dashboard
          </button>

          <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-6">
              <div className={`w-12 h-12 rounded-xl ${typeConfig.iconBg} flex items-center justify-center`}>
                <BrainCircuit className={`w-6 h-6 ${typeConfig.iconColor}`} />
              </div>
              <div>
                <h1 className="text-xl font-bold">{typeConfig.label}</h1>
                <p className="text-muted-foreground text-sm">5 questions · {typeConfig.duration}</p>
              </div>
            </div>

            <div className="space-y-4 mb-8">
              <h2 className="font-semibold text-foreground">Interview Rules</h2>
              <ul className="space-y-3 text-sm text-muted-foreground">
                {[
                  "The AI will speak each question aloud — listen carefully.",
                  "Answer using your voice — speak clearly and naturally.",
                  "A live transcript will appear as you speak.",
                  "Press 'Stop Recording' when done, then click 'Next Question'.",
                  isTechnical
                    ? "Next, you'll choose your tech stack — Gemini AI will generate tailored questions."
                    : "After all questions, Gemini AI will analyze your answers.",
                  "Ensure your microphone is enabled in browser settings.",
                ].map((rule, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">{i + 1}</span>
                    {rule}
                  </li>
                ))}
              </ul>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold gap-2 shadow-[0_0_30px_-5px_rgba(59,130,246,0.4)]"
              onClick={() => isTechnical ? setPhase("tech-stack") : handleStartInterview()}
              data-testid="button-continue"
            >
              <ChevronRight className="w-4 h-4" />
              {isTechnical ? "Choose Tech Stack" : "Start Interview"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── TECH STACK PICKER ────────────────────────────────────────────────────
  if (phase === "tech-stack") {
    const techStackStr = selectedTech.join(", ");
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <div className="max-w-xl w-full">
          <button
            className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm mb-8 transition-colors"
            onClick={() => setPhase("rules")}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="bg-card border border-border rounded-2xl p-8 shadow-xl">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-xl bg-accent/15 flex items-center justify-center">
                <Code className="w-6 h-6 text-accent" />
              </div>
              <div>
                <h1 className="text-xl font-bold">Choose Your Tech Stack</h1>
                <p className="text-muted-foreground text-sm">Gemini AI will generate 5 tailored questions</p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground mb-6">
              Select the technologies you'll be interviewed on. We'll generate personalized questions based on your stack.
            </p>

            {/* Selected chips */}
            {selectedTech.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-4">
                {selectedTech.map((t) => (
                  <Badge
                    key={t}
                    variant="outline"
                    className="bg-accent/10 text-accent border-accent/30 px-3 py-1 gap-1.5 cursor-pointer hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
                    onClick={() => removeTech(t)}
                  >
                    {t} <X className="w-3 h-3" />
                  </Badge>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="flex gap-2 mb-4">
              <Input
                placeholder="Type a technology (e.g. React)"
                value={techStackInput}
                onChange={(e) => setTechStackInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTech(techStackInput); } }}
                className="bg-secondary/50 border-border"
                data-testid="input-tech-stack"
              />
              <Button
                variant="secondary"
                size="icon"
                onClick={() => addTech(techStackInput)}
                disabled={!techStackInput.trim()}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            {/* Quick suggestions */}
            <div className="mb-6">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide mb-2">Quick Add</p>
              <div className="flex flex-wrap gap-2">
                {TECH_STACK_SUGGESTIONS.filter((t) => !selectedTech.includes(t)).map((t) => (
                  <button
                    key={t}
                    className="text-xs px-2.5 py-1 rounded-full bg-secondary hover:bg-secondary/70 border border-border text-muted-foreground hover:text-foreground transition-colors"
                    onClick={() => addTech(t)}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <Button
              className="w-full h-12 text-base font-semibold gap-2"
              onClick={() => handleStartInterview(selectedTech.length > 0 ? techStackStr : undefined)}
              disabled={createInterview.isPending}
              data-testid="button-start-technical"
            >
              {createInterview.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {selectedTech.length > 0 ? "Generating questions with Gemini AI..." : "Starting..."}
                </>
              ) : (
                <>
                  <BrainCircuit className="w-4 h-4" />
                  {selectedTech.length > 0 ? `Generate Questions for ${techStackStr}` : "Start with Default Questions"}
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── GENERATING FEEDBACK ───────────────────────────────────────────────────
  if (phase === "generating") {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <div className="text-center space-y-6">
          <div className="relative mx-auto w-20 h-20">
            <div className="absolute inset-0 rounded-full bg-primary/20 animate-ping" />
            <div className="relative w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
              <BrainCircuit className="w-9 h-9 text-primary" />
            </div>
          </div>
          <div>
            <h2 className="text-2xl font-bold">Analyzing your answers...</h2>
            <p className="text-muted-foreground mt-2 text-sm">Gemini AI is reviewing your responses. This takes about 10 seconds.</p>
          </div>
          <div className="flex justify-center gap-1.5 mt-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="w-2 h-2 rounded-full bg-primary animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── INTERVIEW SESSION ─────────────────────────────────────────────────────
  const questions = config.questions;
  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="flex items-center gap-3 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          Loading questions...
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Bar */}
      <div className="border-b border-border/50 px-4 sm:px-8 py-4 flex items-center justify-between">
        <button
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
          onClick={() => { stopListening(); window.speechSynthesis?.cancel(); setLocation("/dashboard"); }}
        >
          <ArrowLeft className="w-4 h-4" /> Exit
        </button>
        <div className="text-sm text-muted-foreground font-medium">
          Question <span className="text-foreground font-bold">{currentQ + 1}</span> of {questions.length}
        </div>
        <div className="flex items-center gap-2">
          {isTechnical && selectedTech.length > 0 && (
            <Badge variant="outline" className="text-xs bg-accent/10 text-accent border-accent/30 hidden sm:flex">
              {selectedTech.slice(0, 2).join(", ")}{selectedTech.length > 2 ? ` +${selectedTech.length - 2}` : ""}
            </Badge>
          )}
          <span className="text-sm text-muted-foreground">
            {isTechnical ? "Technical" : interviewType === "case_study" ? "Case Study" : "HR"}
          </span>
        </div>
      </div>

      {/* Progress */}
      <div className="px-4 sm:px-8 pt-4">
        <Progress value={progress} className="h-1.5 bg-secondary" />
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-10 max-w-3xl mx-auto w-full gap-8">
        {/* AI Avatar */}
        <div className="flex flex-col items-center gap-3">
          <div className={`relative w-20 h-20 rounded-full flex items-center justify-center ${isSpeaking ? "animate-pulse-ring" : ""}`}>
            <div className="absolute inset-0 rounded-full bg-primary/10" />
            {isSpeaking && <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />}
            <BrainCircuit className="w-10 h-10 text-primary relative z-10" />
          </div>
          {isSpeaking && (
            <div className="flex items-center gap-1.5 text-primary text-xs font-medium">
              <Volume2 className="w-3.5 h-3.5" />
              AI is speaking...
            </div>
          )}
        </div>

        {/* Question */}
        <div className="bg-card border border-border rounded-2xl p-6 sm:p-8 w-full text-center">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-3">Question {currentQ + 1}</p>
          <h2 className="text-xl sm:text-2xl font-bold leading-snug text-foreground" data-testid="text-question">
            {questions[currentQ]}
          </h2>
        </div>

        {/* Transcript */}
        <div className="bg-secondary/40 border border-border rounded-2xl p-5 w-full min-h-[100px]">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider mb-2">Your Answer</p>
          {transcript ? (
            <p className="text-foreground text-sm leading-relaxed" data-testid="text-transcript">{transcript}</p>
          ) : (
            <p className="text-muted-foreground text-sm italic">
              {isRecording ? "Listening... speak your answer" : "Click 'Start Recording' to begin answering"}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-center gap-4 w-full">
          <Button
            variant={isRecording ? "destructive" : "secondary"}
            className={`flex-1 h-12 gap-2 font-semibold ${isRecording ? "animate-pulse-ring" : ""}`}
            onClick={toggleRecording}
            disabled={isSpeaking}
            data-testid="button-toggle-recording"
          >
            {isRecording ? (
              <>
                <div className="flex gap-0.5 items-end h-5">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="w-1 bg-white rounded-full animate-audio-bar" style={{ height: "10px" }} />
                  ))}
                </div>
                Stop Recording
              </>
            ) : (
              <><Mic className="w-4 h-4" /> Start Recording</>
            )}
          </Button>

          <Button
            className="flex-1 h-12 gap-2 font-semibold"
            onClick={handleNextQuestion}
            disabled={updateInterview.isPending || generateFeedback.isPending || isSpeaking}
            data-testid="button-next-question"
          >
            {updateInterview.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</>
            ) : currentQ + 1 >= questions.length ? (
              <><BrainCircuit className="w-4 h-4" /> Finish & Get Feedback</>
            ) : (
              <>Next Question <ChevronRight className="w-4 h-4" /></>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
