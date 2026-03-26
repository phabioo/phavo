import { z } from 'zod';

export const AuthMode = z.enum(['phavo-io', 'local']);
export type AuthMode = z.infer<typeof AuthMode>;

export const SessionSchema = z.object({
  userId: z.string(),
  tier: z.enum(['free', 'standard', 'local']),
  authMode: AuthMode,
  validatedAt: z.number(),
  graceUntil: z.number().optional(),
});
export type Session = z.infer<typeof SessionSchema>;
