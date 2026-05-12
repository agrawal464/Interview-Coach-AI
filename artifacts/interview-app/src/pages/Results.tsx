import { useParams, useLocation } from "wouter";
import { useGetInterview, getGetInterviewQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, RotateCcw, Shuffle, LayoutDashboard, CheckCircle, AlertTriangle, ChevronDown, Mic } from "lucide-react";
import { useState } from "react";

function ScoreRingLarge({ score, label }: { score: number; label: string }) {
  const r = 52;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (circ * score) / 100;
  const color = score >= 70 ? "#34d399" : score >= 50 ? "#f59e0b" : "#f87171";

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative inline-flex items-center justify-center w-32 h-32">
        <svg viewBox="0 0 120 120" className="w-32 h-32 -rotate-90">
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r={r} fill="none"
            stroke={color} strokeWidth="8"
            strokeDasharray={circ}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            style={{ transition: "stroke-dashoffset 1s ease-in-out" }}
          />
        </svg>
        <div className="absolute flex flex-col items-center">
          <span className="text-3xl font-black" style={{ color }}>{score}</span>
          <span className="text-xs text-muted-foreground">/ 100</span>
        </div>
      </div>
      <span className="text-sm text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

function ScoreBar({ label, score, color }: { label: string; score: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="font-bold text-foreground">{score}/100</span>
      </div>
      <div className="h-2 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-1000 ease-out"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function AccordionItem({ question, answer, feedback, index }: { question: string; answer: string; feedback: string; index: number }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-secondary/30 border border-border rounded-xl overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-secondary/50 transition-colors"
        onClick={() => setOpen((v) => !v)}
        data-testid={`accordion-q-${index}`}
      >
        <span className="font-medium text-sm pr-4">Q{index + 1}: {question}</span>
        <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="px-5 pb-5 space-y-4 border-t border-border/50 pt-4">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium mb-1.5">Your Answer</p>
            <p className="text-sm text-foreground/90 bg-background/50 rounded-lg p-3 leading-relaxed">{answer || "(No answer recorded)"}</p>
          </div>
          <div>
            <p className="text-xs text-primary uppercase tracking-wide font-medium mb-1.5">AI Feedback</p>
            <p className="text-sm text-foreground/90 bg-primary/5 border border-primary/20 rounded-lg p-3 leading-relaxed">{feedback}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Results() {
  const params = useParams<{ id: string }>();
  const interviewId = parseInt(params.id ?? "0", 10);
  const [, setLocation] = useLocation();

  const { data: interview, isLoading } = useGetInterview(interviewId, {
    query: { enabled: !!interviewId, queryKey: getGetInterviewQueryKey(interviewId) },
  });

  const feedback = interview?.feedback as any;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground p-8 max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-60 w-full rounded-2xl" />
      </div>
    );
  }

  if (!interview || !feedback) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center px-4">
        <div className="text-center space-y-4">
          <Mic className="w-12 h-12 text-muted-foreground mx-auto" />
          <p className="text-muted-foreground">No feedback found for this session.</p>
          <Button onClick={() => setLocation("/dashboard")} variant="secondary">Go to Dashboard</Button>
        </div>
      </div>
    );
  }

  const questions = (interview.questions as string[]) ?? [];
  const answers = (interview.answers as string[]) ?? [];
  const perQ = (feedback.perQuestionFeedback ?? []) as Array<{ question: string; answer: string; feedback: string }>;

  const typeLabels: Record<string, string> = { hr: "HR Interview", technical: "Technical Interview", case_study: "Case Study Interview" };

  return (
    <div className="min-h-screen bg-background text-foreground pb-16">
      {/* Header */}
      <div className="border-b border-border/50 px-4 sm:px-8 py-4 flex items-center gap-4 sticky top-0 backdrop-blur-md bg-background/80 z-10">
        <button
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm transition-colors"
          onClick={() => setLocation("/dashboard")}
        >
          <ArrowLeft className="w-4 h-4" /> Dashboard
        </button>
        <div className="flex-1" />
        <span className="text-sm text-muted-foreground">{typeLabels[interview.interviewType] ?? interview.interviewType}</span>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-10 space-y-10">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Interview Results</h1>
          <p className="text-muted-foreground mt-1 text-sm">Here's how you performed across all dimensions.</p>
        </div>

        {/* Score Overview */}
        <div className="bg-card border border-border rounded-2xl p-8 flex flex-col items-center gap-8">
          <ScoreRingLarge score={feedback.overallScore ?? 0} label="Overall Score" />

          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4">
            <ScoreBar label="Communication" score={feedback.communicationScore ?? 0} color="#3b82f6" />
            <ScoreBar label="Relevance" score={feedback.relevanceScore ?? 0} color="#8b5cf6" />
            <ScoreBar label="Confidence" score={feedback.confidenceScore ?? 0} color="#14b8a6" />
            <ScoreBar label="Technical Accuracy" score={feedback.technicalScore ?? 0} color="#f59e0b" />
          </div>
        </div>

        {/* Summary */}
        {feedback.summary && (
          <div className="bg-card border border-border rounded-2xl p-6">
            <h2 className="font-semibold text-base mb-3">Overall Summary</h2>
            <p className="text-muted-foreground text-sm leading-relaxed">{feedback.summary}</p>
          </div>
        )}

        {/* Strengths & Improvements */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div className="bg-card border border-emerald-500/20 rounded-2xl p-6">
            <h2 className="font-semibold text-base mb-4 flex items-center gap-2 text-emerald-400">
              <CheckCircle className="w-4 h-4" /> Strengths
            </h2>
            <ul className="space-y-2">
              {(feedback.strengths ?? []).map((s: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/90">
                  <CheckCircle className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-card border border-amber-500/20 rounded-2xl p-6">
            <h2 className="font-semibold text-base mb-4 flex items-center gap-2 text-amber-400">
              <AlertTriangle className="w-4 h-4" /> Areas to Improve
            </h2>
            <ul className="space-y-2">
              {(feedback.improvements ?? []).map((s: string, i: number) => (
                <li key={i} className="flex items-start gap-2.5 text-sm text-foreground/90">
                  <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Per-Question Feedback */}
        <div>
          <h2 className="font-semibold text-base mb-4">Per-Question Feedback</h2>
          <div className="space-y-3">
            {perQ.length > 0
              ? perQ.map((item, i) => (
                  <AccordionItem
                    key={i}
                    index={i}
                    question={item.question}
                    answer={item.answer}
                    feedback={item.feedback}
                  />
                ))
              : questions.map((q, i) => (
                  <AccordionItem
                    key={i}
                    index={i}
                    question={q}
                    answer={answers[i] ?? ""}
                    feedback="No specific feedback available."
                  />
                ))}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-2">
          <Button
            variant="secondary"
            className="flex-1 gap-2"
            onClick={() => setLocation(`/interview/${interview.interviewType}`)}
            data-testid="button-retake"
          >
            <RotateCcw className="w-4 h-4" /> Retake Interview
          </Button>
          <Button
            variant="secondary"
            className="flex-1 gap-2"
            onClick={() => setLocation("/dashboard")}
            data-testid="button-try-different"
          >
            <Shuffle className="w-4 h-4" /> Try Different Type
          </Button>
          <Button
            className="flex-1 gap-2"
            onClick={() => setLocation("/dashboard")}
            data-testid="button-dashboard"
          >
            <LayoutDashboard className="w-4 h-4" /> Go to Dashboard
          </Button>
        </div>
      </div>
    </div>
  );
}
