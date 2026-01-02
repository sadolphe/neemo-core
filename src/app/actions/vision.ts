'use server';

import OpenAI from 'openai';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function analyzeInvoice(formData: FormData) {
    console.log("Analyzing invoice...");
    const file = formData.get('file') as File;

    if (!file) {
        return { error: 'No file provided' };
    }

    try {
        // Convert File to Base64
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Image = buffer.toString('base64');
        const mimeType = file.type;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are an expert OCR and Data Extraction assistant for Moroccan grocery stores (Hanouts).
                    Analyze the provided image (invoice or handwritten list).
                    Extract a list of products with their Name, Quantity, and Unit Price (if available).
                    
                    Return ONLY a JSON object with this structure:
                    {
                        "products": [
                            { "name": "Product Name", "quantity": 10, "buying_price": "5.00" }
                        ]
                    }
                    
                    Rules:
                    - Guess the category or full name if abbreviated (e.g. "Coca" -> "Coca Cola 1L").
                    - Extract the UNIT COST as "buying_price".
                    - If price is missing, put "0".
                    - If quantity is missing, put 1.
                    - Do NOT return markdown formatting (no \`\`\`). Just raw JSON.`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Analyze this image and extract products." },
                        {
                            type: "image_url",
                            image_url: {
                                "url": `data:${mimeType};base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1000,
        });

        const content = response.choices[0].message.content;
        console.log("AI Response:", content);

        if (!content) return { error: "Empty response from AI" };

        // Clean cleanup in case of markdown code blocks
        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanContent);

        return { success: true, data: data };

    } catch (error: any) {
        console.error("Vision Error:", error);
        return { error: error.message };
    }
}

export async function analyzeShelf(formData: FormData) {
    console.log("Analyzing shelf...");
    const file = formData.get('file') as File;

    if (!file) {
        return { error: 'No file provided' };
    }

    try {
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);
        const base64Image = buffer.toString('base64');
        const mimeType = file.type;

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: `You are an expert stock taker for grocery stores.
                    Analyze the provided photo of a store shelf.
                    Identify the distinct products visible and COUNT their quantity.
                    
                    Return ONLY a JSON object with this structure:
                    {
                        "products": [
                            { "name": "Product Name", "quantity": 5 }
                        ]
                    }
                    
                    Rules:
                    - Be precise with counting visible items.
                    - Group identical items together.
                    - Name the products clearly (e.g., "Coca Cola Can", "Lays Chips 50g").
                    - Do NOT return prices, only quantities.
                    - Do NOT return markdown formatting.`
                },
                {
                    role: "user",
                    content: [
                        { type: "text", text: "Count the products on this shelf." },
                        {
                            type: "image_url",
                            image_url: {
                                "url": `data:${mimeType};base64,${base64Image}`
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1000,
        });

        const content = response.choices[0].message.content;
        console.log("AI Response Shelf:", content);

        if (!content) return { error: "Empty response from AI" };

        const cleanContent = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const data = JSON.parse(cleanContent);

        return { success: true, data: data };

    } catch (error: any) {
        console.error("Shelf Vision Error:", error);
        return { error: error.message };
    }
}

export async function pingServer() {
    console.log("🔔 Ping received on server!");
    return { success: true, message: "Pong from server", timestamp: new Date().toISOString() };
}
