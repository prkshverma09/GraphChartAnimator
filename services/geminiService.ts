import { GoogleGenAI, Modality } from "@google/genai";

// Fix(L5): Adhering to @google/genai guidelines by using process.env.API_KEY.
// This also resolves the TypeScript error for 'import.meta.env'.
if (!process.env.API_KEY) {
  // The guidelines state to assume the API key is available. This check is a runtime safeguard.
  throw new Error("Gemini API key (API_KEY) is not set in environment variables.");
}
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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
    const prompt = "Transform this bar chart into a 3D futuristic masterpiece. Give it a sleek, dark theme with vibrant neon highlights and a high-tech feel. The bars should have a sense of depth and perspective. Keep the overall structure, data, and labels intact but render them in a matching 3D style.";
    return processImage(base64Data, mimeType, prompt);
};

export const removeBarsFromImage = async (base64ImageDataWithPrefix: string, mimeType: string): Promise<string> => {
    const base64Data = getRawBase64(base64ImageDataWithPrefix);
    const prompt = "From this 3D futuristic bar chart image, perfectly remove only the colored bars. It is crucial to leave the 3D axes, axis labels, grid lines, title, and background completely intact, preserving their perspective and style. The output should be the empty 3D chart frame.";
    return processImage(base64Data, mimeType, prompt);
};