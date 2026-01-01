import { openai } from '@/lib/openai';

/**
 * Downloads a file from a URL as an ArrayBuffer.
 * Note: specific Twilio auth headers might be needed if "Enforce HTTP Auth" is on.
 */
async function downloadMedia(url: string): Promise<Buffer> {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Failed to download media: ${response.statusText}`);
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

/**
 * Transcribes audio using OpenAI Whisper.
 */
export async function transcribeAudio(mediaUrl: string): Promise<string> {
    try {
        console.log(`[AI] Downloading audio from ${mediaUrl}...`);
        // OpenAI API expects a File object for `file` in node, we can pass a ReadStream or similar.
        // However, the new SDK supports 'fetch' Response objects or similar.
        // Simplest in Node: download to tmp or use the `toFile` helper if available, or just pass the fetch stream if supported.
        // Let's force a fetch and standard File object construction if possible, or simpler: use the file class from 'openai/uploads' doesn't exist publicly cleanly.
        // Standard approach: Download -> fs.createReadStream (if saving) or simple pass as file instance.

        // For Vercel/Serverless, saving to disk is tricky.
        // Let's try passing the fetch response blob directly if supported, or buffer.
        // OpenAI Node SDK `file` argument supports `fs.ReadStream`.

        // Quick fix: Fetch, write to /tmp, read, delete. Safest for MVPs.
        const buffer = await downloadMedia(mediaUrl);

        // We need a File-like object. 
        // In strict Node envs, we can construct a File object if Node version >= 20 or polyfilled.
        // Or we use the 'uploads' helper from openai if available.

        // Let's try the direct File approach (Node 18+ has File)
        const file = new File([buffer as unknown as BlobPart], 'voice_message.ogg', { type: 'audio/ogg' });

        const transcription = await openai.audio.transcriptions.create({
            file: file,
            model: 'whisper-1',
            language: 'ar', // Hint for Arabic/Darija, though Whisper is auto-detect.
            prompt: "Transcribe this Moroccan Darija audio which may contain mixed French/Arabic business terms.",
        });

        return transcription.text;
    } catch (error) {
        console.error('[AI] Transcription failed:', error);
        throw error;
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

