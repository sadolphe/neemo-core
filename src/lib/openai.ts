import OpenAI from 'openai';

const apiKey = process.env.OPENAI_API_KEY;

if (!apiKey) {
    console.warn('[Neemo] OPENAI_API_KEY is not set. Intelligence features will fail.');
}

export const openai = new OpenAI({
    apiKey: apiKey || 'dummy-key', // Prevents crash on build, but will fail at runtime if missing
});
