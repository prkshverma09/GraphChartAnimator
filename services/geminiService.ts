import { GoogleGenAI, Modality } from "@google/genai";

// Fix: Switched from import.meta.env.VITE_GEMINI_API_KEY to process.env.API_KEY to follow Gemini API guidelines and resolve TypeScript error.
const geminiApiKey = process.env.API_KEY;

if (!geminiApiKey) {
  // Fix: Updated error message to reflect the change to process.env.API_KEY.
  throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: geminiApiKey });
const model = 'gemini-2.5-flash-image-preview';

const getRawBase64 = (dataUrl: string): string => {
    const parts = dataUrl.split(',');
    if (parts.length > 1) {
        return parts[1];
    }
    // Assume it might already be raw base64 if no prefix is found
    return dataUrl;
}

const processImage = async (base64ImageData: string, mimeType: string, prompt: string): Promise<string> => {
    try {
        const response = await ai.models.generateContent({
            model: model,
            contents: {
                parts: [
                    {
                        inlineData: {
                            data: base64ImageData,
                            mimeType: mimeType,
                        },
                    },
                    { text: prompt },
                ],
            },
            config: {
                responseModalities: [Modality.IMAGE, Modality.TEXT],
            },
        });

        const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

        if (imagePart && imagePart.inlineData) {
            return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
        }
        
        const textPart = response.candidates?.[0]?.content?.parts?.find(part => part.text);
        if(textPart?.text) {
             throw new Error(`API returned text instead of an image: ${textPart.text}`);
        }

        throw new Error("No image was generated. The response may have been blocked or the content filtered.");
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        throw new Error(`Failed to process image with Gemini. ${error instanceof Error ? error.message : ''}`);
    }
}

export const generateFuturisticImage = async (base64ImageDataWithPrefix: string, mimeType: string): Promise<string> => {
    const base64Data = getRawBase64(base64ImageDataWithPrefix);
    const prompt = "Make this bar chart look futuristic and sleek, with a dark theme, neon highlights, and a high-tech feel. Keep the overall structure, data, and labels intact.";
    return processImage(base64Data, mimeType, prompt);
};

export const removeBarsFromImage = async (base64ImageDataWithPrefix: string, mimeType: string): Promise<string> => {
    const base64Data = getRawBase64(base64ImageDataWithPrefix);
    const prompt = "From this bar chart image, remove only the colored bars. Leave the axes, axis labels, grid lines, title, and background perfectly intact. The output should be just the chart's frame and background without the bars.";
    return processImage(base64Data, mimeType, prompt);
};