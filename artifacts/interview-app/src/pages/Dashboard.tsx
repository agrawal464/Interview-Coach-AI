import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useListInterviews,
  useGetInterviewStats,
  useDeleteInterview,
  getListInterviewsQueryKey,
  getGetInterviewStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Mic, Code, Briefcase, Clock, Trophy, BarChart2, Trash2, Play, LogOut } from "lucide-react";
import { useClerk } from "@clerk/react";

const INTERVIEW_TYPES = [
  {
    id: "hr",
    label: "HR Interview",
    icon: Briefcase,
    description: "Behavioral & soft skill questions to assess your interpersonal strengths.",
    difficulty: "Moderate",
    difficultyColor: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    duration: "~15 min",
    iconBg: "bg-primary/15",
    iconColor: "text-primary",
    borderHover: "hover:border-primary/50",
    glowColor: "hover:shadow-[0_0_30px_-5px_rgba(59,130,246,0.3)]",
  },
  {
    id: "technical",
    label: "Technical Interview",
    icon: Code,
    description: "DSA, coding concepts, and CS fundamentals for software engineering roles.",
    difficulty: "Hard",
    difficultyColor: "bg-rose-500/20 text-rose-400 border-rose-500/30",
    duration: "~20 min",
    iconBg: "bg-accent/15",
    iconColor: "text-accent",
    borderHover: "hover:border-accent/50",
    glowColor: "hover:shadow-[0_0_30px_-5px_rgba(139,92,246,0.3)]",
  },
  {
    id: "case_study",
    label: "Case Study Interview",
    icon: BarChart2,
    description: "Problem-solving, estimation, and business scenario analysis.",
    difficulty: "Expert",
    difficultyColor: "bg-teal-500/20 text-teal-400 border-teal-500/30",
    duration: "~20 min",
    iconBg: "bg-teal-500/15",
    iconColor: "text-teal-400",
    borderHover: "hover:border-teal-500/50",
    glowColor: "hover:shadow-[0_0_30px_-5px_rgba(45,212,191,0.3)]",
  },
];

function ScoreRing({ score }: { score: number }) {
  const r = 20;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ - (circ * score) / 100;
  const color = score >= 70 ? "#22d3ee" : score >= 50 ? "#f59e0b" : "#f87171";
  return (
    <div className="relative inline-flex items-center justify-center w-12 h-12">
      <svg viewBox="0 0 48 48" className="w-12 h-12 -rotate-90">
        <circle cx="24" cy="24" r={r} fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="4" />
        <circle
          cx="24" cy="24" r={r} fill="none"
          stroke={color} strokeWidth="4"
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-xs font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function typeLabel(type: string) {
  return INTERVIEW_TYPES.find((t) => t.id === type)?.label ?? type;
}

export default function Dashboard() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const { data: interviews, isLoading: loadingInterviews } = useListInterviews();
  const { data: stats, isLoading: loadingStats } = useGetInterviewStats();

  const deleteInterview = useDeleteInterview({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListInterviewsQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetInterviewStatsQueryKey() });
      },
    },
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 px-6 lg:px-12 py-4 flex items-center justify-between sticky top-0 z-30 backdrop-blur-md bg-background/80">
        <div className="flex items-center gap-2 text-primary font-bold text-lg tracking-tight">
          <Mic className="w-5 h-5" />
          <span>MockMate</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground hidden sm:block">
            {user?.emailAddresses[0]?.emailAddress}
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground gap-2"
            onClick={() => signOut(() => setLocation("/"))}
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign Out</span>
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-12">
        {/* Welcome */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">{user?.firstName || "there"}</span>
          </h1>
          <p className="text-muted-foreground mt-1">Your AI interview cockpit is ready.</p>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Sessions", value: loadingStats ? "—" : stats?.totalInterviews ?? 0, icon: Mic },
            { label: "Completed", value: loadingStats ? "—" : stats?.completedInterviews ?? 0, icon: Trophy },
            { label: "Average Score", value: loadingStats ? "—" : stats?.averageScore != null ? Math.round(stats.averageScore) : "—", icon: BarChart2 },
            { label: "HR Interviews", value: loadingStats ? "—" : stats?.byType?.hr ?? 0, icon: Briefcase },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-4 flex flex-col gap-1">
              <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium uppercase tracking-wide">
                <Icon className="w-3.5 h-3.5" />
                {label}
              </div>
              <div className="text-2xl font-bold text-foreground">{value}</div>
            </div>
          ))}
        </div>

        {/* Interview Type Cards */}
        <section>
          <h2 className="text-xl font-bold mb-5">Choose Interview Type</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {INTERVIEW_TYPES.map((type) => {
              const Icon = type.icon;
              return (
                <div
                  key={type.id}
                  className={`bg-card border border-border rounded-2xl p-6 flex flex-col gap-4 transition-all duration-300 cursor-pointer ${type.borderHover} ${type.glowColor}`}
                  onClick={() => setLocation(`/interview/${type.id}`)}
                  data-testid={`card-interview-${type.id}`}
                >
                  <div className="flex items-start justify-between">
                    <div className={`w-12 h-12 rounded-xl ${type.iconBg} flex items-center justify-center`}>
                      <Icon className={`w-6 h-6 ${type.iconColor}`} />
                    </div>
                    <Badge variant="outline" className={`text-xs ${type.difficultyColor}`}>
                      {type.difficulty}
                    </Badge>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg mb-1">{type.label}</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed">{type.description}</p>
                  </div>
                  <div className="flex items-center justify-between mt-auto pt-2">
                    <div className="flex items-center gap-1.5 text-muted-foreground text-xs">
                      <Clock className="w-3.5 h-3.5" />
                      {type.duration}
                    </div>
                    <Button
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={(e) => { e.stopPropagation(); setLocation(`/interview/${type.id}`); }}
                      data-testid={`button-start-${type.id}`}
                    >
                      <Play className="w-3.5 h-3.5" /> Start
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Past Interviews */}
        <section>
          <h2 className="text-xl font-bold mb-5">My Past Interviews</h2>
          {loadingInterviews ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
            </div>
          ) : !interviews || interviews.length === 0 ? (
            <div className="bg-card border border-border rounded-2xl p-10 text-center text-muted-foreground">
              <Mic className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No interviews yet</p>
              <p className="text-sm mt-1">Start your first session above to track your progress.</p>
            </div>
          ) : (
            <div className="bg-card border border-border rounded-2xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="text-left px-5 py-3 font-medium">Type</th>
                    <th className="text-left px-5 py-3 font-medium hidden sm:table-cell">Date</th>
                    <th className="text-center px-5 py-3 font-medium">Score</th>
                    <th className="text-center px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {interviews.map((iv, idx) => (
                    <tr
                      key={iv.id}
                      className={`border-b border-border/30 last:border-0 hover:bg-secondary/30 transition-colors cursor-pointer ${idx % 2 === 0 ? "" : "bg-secondary/10"}`}
                      onClick={() => iv.status === "completed" && setLocation(`/interview/${iv.id}/results`)}
                      data-testid={`row-interview-${iv.id}`}
                    >
                      <td className="px-5 py-3.5 font-medium">{typeLabel(iv.interviewType)}</td>
                      <td className="px-5 py-3.5 text-muted-foreground hidden sm:table-cell">{formatDate(iv.createdAt)}</td>
                      <td className="px-5 py-3.5 text-center">
                        {iv.score != null ? <ScoreRing score={iv.score} /> : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <Badge
                          variant="outline"
                          className={
                            iv.status === "completed"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                              : iv.status === "in_progress"
                              ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                              : "bg-secondary text-muted-foreground"
                          }
                        >
                          {iv.status === "in_progress" ? "In Progress" : iv.status === "completed" ? "Completed" : "Pending"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="w-7 h-7 text-muted-foreground hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteInterview.mutate({ id: iv.id });
                          }}
                          data-testid={`button-delete-${iv.id}`}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
