import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Mic, BrainCircuit, Activity, Zap } from "lucide-react";

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden flex flex-col relative">
      {/* Background gradients */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[40%] h-[40%] bg-accent/20 blur-[100px] rounded-full pointer-events-none" />
      
      <header className="px-6 lg:px-12 py-6 flex items-center justify-between z-10">
        <div className="flex items-center gap-2 text-primary font-bold text-xl tracking-tight">
          <Mic className="w-6 h-6" />
          <span>InterviewAI</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/sign-in">
            <Button variant="ghost" className="text-muted-foreground hover:text-white">Sign In</Button>
          </Link>
          <Link href="/sign-up">
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold">
              Get Started
            </Button>
          </Link>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center text-center px-4 z-10 relative">
        <div className="max-w-4xl mx-auto space-y-8">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/50 border border-border text-sm text-primary font-medium mb-4">
            <Zap className="w-4 h-4" />
            <span className="bg-clip-text text-transparent bg-gradient-to-r from-primary to-accent">Next-generation AI coaching</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight">
            Master your next interview. <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-accent">With an AI co-pilot.</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Experience high-stakes voice interviews with real-time feedback. 
            Train your communication, technical skills, and confidence in a cinematic cockpit.
          </p>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/sign-up">
              <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg bg-primary hover:bg-primary/90 shadow-[0_0_40px_-10px_rgba(59,130,246,0.5)]">
                Start Practicing Free
              </Button>
            </Link>
          </div>
        </div>

        <div className="mt-24 grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto text-left">
          <div className="p-6 rounded-2xl bg-card border border-border">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
              <Mic className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-xl font-bold mb-2">Voice-First Experience</h3>
            <p className="text-muted-foreground">Talk naturally. Our AI listens, transcribes, and analyzes your tone and delivery in real-time.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border">
            <div className="w-12 h-12 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
              <BrainCircuit className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-xl font-bold mb-2">Deep AI Feedback</h3>
            <p className="text-muted-foreground">Get actionable feedback on technical accuracy, relevance, and communication style instantly.</p>
          </div>
          <div className="p-6 rounded-2xl bg-card border border-border">
            <div className="w-12 h-12 rounded-lg bg-teal-500/10 flex items-center justify-center mb-4">
              <Activity className="w-6 h-6 text-teal-400" />
            </div>
            <h3 className="text-xl font-bold mb-2">Track Progress</h3>
            <p className="text-muted-foreground">Monitor your scores over time and watch your confidence grow as you complete more sessions.</p>
          </div>
        </div>
      </main>
      
      <footer className="py-8 text-center text-muted-foreground border-t border-border/50 z-10">
        <p>© {new Date().getFullYear()} InterviewAI. Elevate your career.</p>
      </footer>
    </div>
  );
}