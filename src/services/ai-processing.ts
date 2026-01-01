import fs from 'fs';
import path from 'path';
import os from 'os';
import { openai } from '@/lib/openai';

/**
 * Downloads a file from a URL as an ArrayBuffer, handling Twilio 302 Redirects manually.
 * This prevents sending Twilio Auth headers to AWS S3 (which causes S3 to reject the request).
 */
async function downloadMedia(url: string): Promise<Buffer> {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    const headers: HeadersInit = {};
    const isTwilioUrl = url.includes('twilio.com');

    // Add Auth ONLY for Twilio URLs
    if (isTwilioUrl && accountSid && authToken) {
        const credentials = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
    }

    // First request with 'manual' redirect handling to catch the 302
    let response = await fetch(url, { headers, redirect: 'manual' });

    // Handle Redirect (Twilio -> S3)
    if ([301, 302, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        if (location) {
            console.log('[AI] Following redirect to S3 (no auth)...');
            // Fetch the S3 URL *without* headers
            response = await fetch(location);
        }
    }

    if (!response.ok) {
        throw new Error(`Failed to download media: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Transcribes audio using OpenAI Whisper.
 * Uses /tmp directory to safely create a file stream for OpenAI SDK.
 */
export async function transcribeAudio(mediaUrl: string): Promise<string> {
    const tmpPath = path.join(os.tmpdir(), `neemo_${Date.now()}.ogg`);

    try {
        console.log(`[AI] Downloading audio from ${mediaUrl}...`);
        const buffer = await downloadMedia(mediaUrl);

        // Write to /tmp to create a valid fs.ReadStream
        await fs.promises.writeFile(tmpPath, buffer);
        console.log(`[AI] Audio saved to ${tmpPath}, sending to Whisper...`);

        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(tmpPath),
            model: 'whisper-1',
            language: 'ar',
            prompt: "Transcribe this Moroccan Darija audio which may contain mixed French/Arabic business terms.",
        });

        return transcription.text;
    } catch (error) {
        console.error('[AI] Transcription failed:', error);
        throw error;
    } finally {
        // Cleanup /tmp file
        if (fs.existsSync(tmpPath)) {
            fs.promises.unlink(tmpPath).catch(() => { });
        }
    }
}

/**
 * Extracts invoice data using GPT-4o Vision.
 */
export async function analyzeInvoiceImage(mediaUrl: string): Promise<any> {
    try {
        // GPT-4o accepts URLs directly!
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert OCR assistant for Moroccan commerce. 
          Extract the following fields from the invoice image:
          - Supplier Name (fournisseur)
          - Date
          - Total Amount (montant_total)
          - Items (list of {product, quantity, price_unit, total_price})
          
          Return ONLY valid JSON. No markdown formatting.`
                },
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: "Analyse cette facture." },
                        {
                            type: 'image_url',
                            image_url: {
                                url: mediaUrl,
                            },
                        },
                    ],
                },
            ],
            max_tokens: 1000,
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        if (!content) throw new Error("No content derived from image");

        return JSON.parse(content);
    } catch (error) {
        console.error('[AI] Image analysis failed:', error);
        throw error;
    }
}

/**
 * Interprets a voice command to update shop settings.
 */
export async function interpretVoiceCommand(text: string): Promise<{ intent: string; value?: string; reply: string }> {
    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: `You are Neemo, an assistant for Moroccan shopkeepers.
          Analyze the user's text (transcribed from Darija/French).
          Identify if they want to update their shop profile.
          
          Possible Intents:
          - 'UPDATE_STATUS': Open/Close the shop. Value: 'open' | 'closed'.
          - 'UPDATE_HOURS': Change opening hours. Value: e.g., '09:00 - 22:00'.
          - 'OTHER': Any other request (orders, chitchat).

          Return JSON: { intent, value, reply_in_darija }.
          reply_in_darija: A short confirmation string in Darija/French mix. Example: "Safi, c'est fermé." or "D'accord, horaires mis à jour."
          `
                },
                {
                    role: 'user',
                    content: text,
                },
            ],
            response_format: { type: "json_object" }
        });

        const content = response.choices[0].message.content;
        if (!content) return { intent: 'OTHER', reply: 'Fhamt walou.' };

        return JSON.parse(content);
    } catch (error) {
        console.error('[AI] Intent interpretation failed:', error);
        return { intent: 'ERROR', reply: 'Désolé, problème technique.' };
    }
}

