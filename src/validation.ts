import { z } from "zod";
import { ApiError } from "./errors.js";
const text = z.string().trim().min(1, "can't be blank");
const password = z
  .string()
  .min(1, "can't be blank")
  .min(8, "must be at least 8 characters")
  .max(1024);
export const registration = z.object({
  username: text,
  email: text.email(),
  password,
});
export const login = z.object({
  email: text,
  password: z.string().min(1, "can't be blank"),
});
export const userUpdate = z.object({
  username: text.optional(),
  email: text.email().optional(),
  password: password.optional(),
  bio: z.string().nullable().optional(),
  image: z.string().nullable().optional(),
});
export const articleCreate = z.object({
  title: text,
  description: text,
  body: text,
  tagList: z.array(text).optional().default([]),
});
export const articleUpdate = z.object({
  title: text.optional(),
  description: text.optional(),
  body: text.optional(),
  tagList: z.array(text).optional(),
});
export const commentCreate = z.object({ body: text });
export const pagination = z.object({
  limit: z.coerce.number().int().min(0).max(1000).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  tag: z.string().optional(),
  author: z.string().optional(),
  favorited: z.string().optional(),
});
export function validate<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const errors: Record<string, string[]> = {};
  for (const i of result.error.issues) {
    const key = String(i.path[0] ?? "body");
    (errors[key] ??= []).push(i.message);
  }
  throw new ApiError(422, errors);
}
