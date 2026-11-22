import { randomInt } from 'node:crypto'

export type VerificationEmailService = {
  generateCode: () => string
  sendCode: (email: string, code: string) => Promise<void>
}

export const consoleVerificationEmail: VerificationEmailService = {
  generateCode: () => randomInt(0, 1_000_000).toString().padStart(6, '0'),
  sendCode: async (email, code) => { console.log(`Verification code for ${email}: ${code}`) },
}
