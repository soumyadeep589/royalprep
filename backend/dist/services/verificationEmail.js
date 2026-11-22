import { randomInt } from 'node:crypto';
export const consoleVerificationEmail = {
    generateCode: () => randomInt(0, 1_000_000).toString().padStart(6, '0'),
    sendCode: async (email, code) => { console.log(`Verification code for ${email}: ${code}`); },
};
