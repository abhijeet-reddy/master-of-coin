import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
  password: z.string().min(1, 'Enter your password'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const PASSWORD_MIN = 8;

export const registerSchema = z
  .object({
    username: z.string().trim().min(3, 'At least 3 characters').max(50, 'At most 50 characters'),
    email: z.string().trim().min(1, 'Enter your email').email('Enter a valid email'),
    name: z.string().trim().min(1, 'Enter your name').max(100, 'At most 100 characters'),
    password: z.string().min(PASSWORD_MIN, `Must be at least ${PASSWORD_MIN} characters`),
    confirmPassword: z.string().min(1, 'Confirm your password'),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });
export type RegisterValues = z.infer<typeof registerSchema>;
