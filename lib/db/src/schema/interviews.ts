import { pgTable, serial, text, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const interviewsTable = pgTable("interviews", {
  id: serial("id").primaryKey(),
  userId: text("user_id").notNull(),
  interviewType: text("interview_type").notNull(),
  status: text("status").notNull().default("pending"),
  score: integer("score"),
  questionsAnswered: integer("questions_answered").notNull().default(0),
  totalQuestions: integer("total_questions").notNull().default(5),
  questions: jsonb("questions").$type<string[]>().notNull().default([]),
  answers: jsonb("answers").$type<string[]>().notNull().default([]),
  feedback: jsonb("feedback").$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const insertInterviewSchema = createInsertSchema(interviewsTable).omit({ id: true, createdAt: true });
export type InsertInterview = z.infer<typeof insertInterviewSchema>;
export type Interview = typeof interviewsTable.$inferSelect;
