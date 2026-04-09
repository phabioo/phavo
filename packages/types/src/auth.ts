import { z } from 'zod';

export const AuthMode = z.enum(['phavo-net', 'local']);
export type AuthMode = z.infer<typeof AuthMode>;

export const SessionSchema = z.object({
  userId: z.string(),
  tier: z.enum(['stellar', 'celestial']),
  authMode: AuthMode,
  validatedAt: z.number(),
  graceUntil: z.number().optional(),
});
export type Session = z.infer<typeof SessionSchema>;
