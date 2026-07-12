import { Router, type IRouter } from "express";
import { eq, and, desc } from "drizzle-orm";
import { getAuth } from "@clerk/express";
import { db, interviewsTable } from "@workspace/db";
import { ai } from "@workspace/integrations-gemini-ai";
import {
  CreateInterviewBody,
  GetInterviewParams,
  UpdateInterviewParams,
  UpdateInterviewBody,
  DeleteInterviewParams,
  GenerateFeedbackParams,
} from "@workspace/api-zod";

const router: IRouter = Router();

const FALLBACK_QUESTIONS: Record<string, string[]> = {
  hr: [
    "Tell me about yourself.",
    "Why do you want this role?",
    "Describe a conflict situation you faced and how you resolved it.",
    "Where do you see yourself in 5 years?",
    "What are your greatest strengths and weaknesses?",
  ],
  technical: [
    "Explain the four pillars of Object-Oriented Programming.",
    "What is a REST API and how does it differ from GraphQL?",
    "What is the difference between SQL and NoSQL databases?",
    "Explain time complexity and Big O notation with examples.",
    "What is recursion? Give an example of a problem it solves well.",
  ],
  case_study: [
    "How would you increase revenue for a product that is declining in sales?",
    "Estimate the number of smartphones sold in India per year.",
    "How would you prioritize features for a new mobile app launch?",
    "A popular app loses 30% of its users in one month. How do you diagnose and fix this?",
    "You are the PM for a ride-sharing app. How do you grow the driver supply?",
  ],
};

function requireAuth(req: any, res: any, next: any) {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  req.userId = userId;
  next();
}

async function generateTechnicalQuestions(techStack: string): Promise<string[]> {
  const response = await ai.models.generateContent({
    model: "gemini-1.5-pro",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `Generate exactly 5 technical interview questions for a candidate applying for a role using the following tech stack: ${techStack}.

The questions should:
- Be specific to the technologies mentioned
- Range from fundamental to intermediate difficulty
- Test practical knowledge and problem-solving
- Be clear and concise

Respond with ONLY a JSON array of 5 strings, no markdown, no explanation. Example format:
["Question 1?", "Question 2?", "Question 3?", "Question 4?", "Question 5?"]`,
          },
        ],
      },
    ],
    config: { maxOutputTokens: 8192 },
  });

  const text = response.text ?? "";
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();
  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("Invalid questions format");
  return parsed.slice(0, 5);
}

router.get("/interviews/stats/summary", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;

  const all = await db
    .select()
    .from(interviewsTable)
    .where(eq(interviewsTable.userId, userId));

  const completed = all.filter((i) => i.status === "completed");
  const scores = completed.filter((i) => i.score !== null).map((i) => i.score as number);
  const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;

  const byType = { hr: 0, technical: 0, case_study: 0 } as Record<string, number>;
  for (const i of all) {
    if (i.interviewType in byType) byType[i.interviewType]++;
  }

  res.json({
    totalInterviews: all.length,
    completedInterviews: completed.length,
    averageScore: avgScore,
    byType,
    recentScores: scores.slice(-5),
  });
});

router.get("/interviews", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;

  const interviews = await db
    .select()
    .from(interviewsTable)
    .where(eq(interviewsTable.userId, userId))
    .orderBy(desc(interviewsTable.createdAt));

  res.json(
    interviews.map((i) => ({
      id: i.id,
      userId: i.userId,
      interviewType: i.interviewType,
      techStack: i.techStack ?? null,
      status: i.status,
      score: i.score,
      questionsAnswered: i.questionsAnswered,
      totalQuestions: i.totalQuestions,
      createdAt: i.createdAt,
      completedAt: i.completedAt,
    }))
  );
});

router.post("/interviews", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;
  const parsed = CreateInterviewBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { interviewType, techStack } = parsed.data;
  let questions: string[];

  if (interviewType === "technical" && techStack) {
    try {
      questions = await generateTechnicalQuestions(techStack);
    } catch {
      questions = FALLBACK_QUESTIONS.technical;
    }
  } else {
    questions = FALLBACK_QUESTIONS[interviewType] || FALLBACK_QUESTIONS.hr;
  }

  const [interview] = await db
    .insert(interviewsTable)
    .values({
      userId,
      interviewType,
      techStack: techStack ?? null,
      status: "pending",
      questions,
      answers: [],
      questionsAnswered: 0,
      totalQuestions: questions.length,
    })
    .returning();

  res.status(201).json({
    id: interview.id,
    userId: interview.userId,
    interviewType: interview.interviewType,
    techStack: interview.techStack ?? null,
    status: interview.status,
    score: interview.score,
    questionsAnswered: interview.questionsAnswered,
    totalQuestions: interview.totalQuestions,
    createdAt: interview.createdAt,
    completedAt: interview.completedAt,
  });
});

router.get("/interviews/:id", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GetInterviewParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [interview] = await db
    .select()
    .from(interviewsTable)
    .where(and(eq(interviewsTable.id, params.data.id), eq(interviewsTable.userId, userId)));

  if (!interview) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  res.json({
    id: interview.id,
    userId: interview.userId,
    interviewType: interview.interviewType,
    techStack: interview.techStack ?? null,
    status: interview.status,
    score: interview.score,
    questionsAnswered: interview.questionsAnswered,
    totalQuestions: interview.totalQuestions,
    questions: interview.questions || [],
    answers: interview.answers || [],
    feedback: interview.feedback,
    createdAt: interview.createdAt,
    completedAt: interview.completedAt,
  });
});

router.patch("/interviews/:id", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = UpdateInterviewParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = UpdateInterviewBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const updateData: Record<string, unknown> = {};
  if (body.data.status !== undefined) updateData.status = body.data.status;
  if (body.data.questions !== undefined) updateData.questions = body.data.questions;
  if (body.data.answers !== undefined) updateData.answers = body.data.answers;
  if (body.data.questionsAnswered !== undefined) updateData.questionsAnswered = body.data.questionsAnswered;
  if (body.data.status === "completed") updateData.completedAt = new Date();

  const [updated] = await db
    .update(interviewsTable)
    .set(updateData)
    .where(and(eq(interviewsTable.id, params.data.id), eq(interviewsTable.userId, userId)))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  res.json({
    id: updated.id,
    userId: updated.userId,
    interviewType: updated.interviewType,
    techStack: updated.techStack ?? null,
    status: updated.status,
    score: updated.score,
    questionsAnswered: updated.questionsAnswered,
    totalQuestions: updated.totalQuestions,
    createdAt: updated.createdAt,
    completedAt: updated.completedAt,
  });
});

router.delete("/interviews/:id", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = DeleteInterviewParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [deleted] = await db
    .delete(interviewsTable)
    .where(and(eq(interviewsTable.id, params.data.id), eq(interviewsTable.userId, userId)))
    .returning();

  if (!deleted) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  res.sendStatus(204);
});

router.post("/interviews/:id/feedback", requireAuth, async (req: any, res): Promise<void> => {
  const userId = req.userId as string;
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const params = GenerateFeedbackParams.safeParse({ id: parseInt(raw, 10) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [interview] = await db
    .select()
    .from(interviewsTable)
    .where(and(eq(interviewsTable.id, params.data.id), eq(interviewsTable.userId, userId)));

  if (!interview) {
    res.status(404).json({ error: "Interview not found" });
    return;
  }

  const questions = (interview.questions as string[]) || [];
  const answers = (interview.answers as string[]) || [];

  const qaText = questions
    .map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${answers[i] || "(no answer provided)"}`)
    .join("\n\n");

  const techContext = interview.techStack ? `Tech Stack: ${interview.techStack}\n` : "";

  const response = await ai.models.generateContent({
    model: "gemini-1.5-pro",
    contents: [
      {
        role: "user",
        parts: [
          {
            text: `You are an expert interview coach. Analyze the candidate's interview answers and return ONLY a valid JSON object with no markdown, no code blocks, no extra text.

Interview Type: ${interview.interviewType}
${techContext}
Questions and Answers:
${qaText}

Return a JSON object with exactly these fields:
{
  "overallScore": <integer 0-100>,
  "communicationScore": <integer 0-100>,
  "relevanceScore": <integer 0-100>,
  "confidenceScore": <integer 0-100>,
  "technicalScore": <integer 0-100>,
  "strengths": [<3-4 specific strength strings>],
  "improvements": [<3-4 specific improvement strings>],
  "perQuestionFeedback": [{"question": <string>, "answer": <string>, "feedback": <string>}],
  "summary": <2-3 sentence overall summary string>
}`,
          },
        ],
      },
    ],
    config: { maxOutputTokens: 8192, responseMimeType: "application/json" },
  });

  const text = response.text ?? "";
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```\s*$/, "").trim();

  let feedback: Record<string, unknown>;
  try {
    feedback = JSON.parse(cleaned);
  } catch {
    res.status(500).json({ error: "Failed to parse AI feedback" });
    return;
  }

  const score = typeof feedback.overallScore === "number" ? feedback.overallScore : null;

  await db
    .update(interviewsTable)
    .set({ feedback, score, status: "completed", completedAt: new Date() })
    .where(eq(interviewsTable.id, params.data.id));

  res.json(feedback);
});

export default router;
