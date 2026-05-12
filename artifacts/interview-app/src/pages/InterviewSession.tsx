import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Mic, MicOff, ChevronRight, ArrowLeft, BrainCircuit, Loader2, Volume2 } from "lucide-react";
import {
  useCreateInterview,
  useUpdateInterview,
  useGenerateFeedback,
  getListInterviewsQueryKey,
  getGetInterviewStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

const QUESTIONS: Record<string, { questions: string[]; duration: string; label: string }> = {
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
  technical: {
    label: "Technical Interview",
    duration: "~20 min",
    questions: [
      "Explain the four pillars of Object-Oriented Programming.",
      "What is a REST API and how does it differ from GraphQL?",
      "What is the difference between SQL and NoSQL databases?",
      "Explain time complexity and Big O notation with examples.",
      "What is recursion? Give an example of a problem it solves well.",
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

type Phase = "rules" | "interview" | "generating";

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
  const config = QUESTIONS[interviewType] ?? QUESTIONS.hr;

  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const [phase, setPhase] = useState<Phase>("rules");
  const [interviewId, setInterviewId] = useState<number | null>(null);
  const [currentQ, setCurrentQ] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [transcript, setTranscript] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const recognitionRef = useRef<ISpeechRecognition | null>(null);
  const speechSynthRef = useRef<SpeechSynthesisUtterance | null>(null);

  const createInterview = useCreateInterview();
  const updateInterview = useUpdateInterview();
  const generateFeedback = useGenerateFeedback();

  const speakText = useCallback((text: string) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.rate = 0.9;
    utt.pitch = 1;
    utt.volume = 1;
    utt.onstart = () => setIsSpeaking(true);
    utt.onend = () => { setIsSpeaking(false); startListening(); };
    utt.onerror = () => { setIsSpeaking(false); startListening(); };
    speechSynthRef.current = utt;
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
        for (let i = 0; i < e.results.length; i++) {
          full += e.results[i][0].transcript;
        }
        setTranscript(full);
      };

      rec.onend = () => {
        setIsRecording(false);
      };

      rec.onerror = () => {
        setIsRecording(false);
      };

      recognitionRef.current = rec;
      rec.start();
      setIsRecording(true);
      setTranscript("");
    } catch {
      setIsRecording(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsRecording(false);
  }, []);

  useEffect(() => {
    if (phase === "interview") {
      speakText(config.questions[currentQ]);
    }
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
    };
  }, [phase, currentQ]);

  useEffect(() => {
    return () => {
      window.speechSynthesis?.cancel();
      recognitionRef.current?.stop();
    };
  }, []);

  const handleStartInterview = () => {
    createInterview.mutate(
      { data: { interviewType: interviewType as "hr" | "technical" | "case_study" } },
      {
        onSuccess: (session) => {
          setInterviewId(session.id);
          setPhase("interview");
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

    await updateInterview.mutateAsync({
      id: interviewId,
      data: {
        answers: newAnswers,
        questionsAnswered: newAnswers.length,
        status: newAnswers.length >= config.questions.length ? "completed" : "in_progress",
      },
    });

    if (newAnswers.length >= config.questions.length) {
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
    if (isRecording) {
      stopListening();
    } else {
      window.speechSynthesis?.cancel();
      startListening();
    }
  };

  const progress = phase === "interview" ? ((currentQ) / config.questions.length) * 100 : 0;

  if (phase === "rules") {
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
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                <BrainCircuit className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{config.label}</h1>
                <p className="text-muted-foreground text-sm">{config.questions.length} questions · {config.duration}</p>
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
                  "After all questions, Claude AI will analyze your answers.",
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
              onClick={handleStartInterview}
              disabled={createInterview.isPending}
              data-testid="button-start-interview"
            >
              {createInterview.isPending ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Starting...</>
              ) : (
                <><Mic className="w-4 h-4" /> Start Interview</>
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }

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
            <p className="text-muted-foreground mt-2 text-sm">Claude AI is reviewing your responses. This takes about 10 seconds.</p>
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
          Question <span className="text-foreground font-bold">{currentQ + 1}</span> of {config.questions.length}
        </div>
        <div className="text-sm text-muted-foreground">{config.label}</div>
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
            {config.questions[currentQ]}
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
            ) : currentQ + 1 >= config.questions.length ? (
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
