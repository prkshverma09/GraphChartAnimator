import { GoogleGenAI, Modality } from "@google/genai";

// Callback to update progress for the UI
type ProgressCallback = (message: string) => void;

// Fix: Per coding guidelines, API key is sourced directly from process.env.API_KEY.
// This also resolves the TypeScript error "Property 'env' does not exist on type 'ImportMeta'".
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const imageModel = 'gemini-2.5-flash-image-preview';
const videoModel = 'veo-2.0-generate-001';

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
            model: imageModel,
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

export const generateVideoWithVeo = async (
    base64ImageDataWithPrefix: string,
    mimeType: string,
    onProgress: ProgressCallback
): Promise<string> => {
    const base64Data = getRawBase64(base64ImageDataWithPrefix);
    const prompt = `You are a precise data visualization animator. You will receive a single image that represents the **final frame** of an animation.

The **start frame** of your animation is implied. It is the exact same scene as the final frame, but with all the vertical bars completely removed. Imagine the chart is empty, showing only the 3D axes, grid lines, and labels.

Your task is to generate a video that animates a smooth transition from the implied **start frame** to the provided **final frame**.

**Animation Instructions:**
1.  All bars must begin rising from the baseline (zero height) at the exact same moment.
2.  All bars must rise smoothly and simultaneously to their final heights.
3.  Each bar's final height must PRECISELY match the height shown in the provided image. Do not approximate.

**Strict Rules:**
-   DO NOT add any bars that are not present in the provided image.
-   DO NOT omit any bars that are present in the provided image. The number of bars must be identical.
-   The final rendered frame of the video must be a pixel-perfect match to the input image. You must adhere strictly to the data visualization provided.`;

    try {
        onProgress("Sending request to Google Veo...");
        let operation = await ai.models.generateVideos({
            model: videoModel,
            prompt: prompt,
            image: {
                imageBytes: base64Data,
                mimeType: mimeType,
            },
            config: {
                numberOfVideos: 1
            }
        });

        onProgress("Task created. Polling for video result...");
        let pollingAttempts = 0;
        const maxAttempts = 90; // Poll for up to 15 minutes (90 attempts * 10 seconds)
        
        while (!operation.done && pollingAttempts < maxAttempts) {
            pollingAttempts++;
            onProgress(`Checking video status... (This can take several minutes)`);
            await new Promise(resolve => setTimeout(resolve, 10000)); // Wait 10 seconds
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        if (!operation.done) {
            throw new Error("Video generation timed out. The task took too long to complete.");
        }

        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

        if (!downloadLink) {
            throw new Error("Video generation completed, but no download link was returned.");
        }

        onProgress("Video generated. Downloading...");

        // Securely fetch the video using the API key and create a local blob URL
        const videoResponse = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download the generated video. Status: ${videoResponse.statusText}`);
        }
        const videoBlob = await videoResponse.blob();
        const videoObjectUrl = URL.createObjectURL(videoBlob);
        
        onProgress("Video generation complete!");
        return videoObjectUrl;

    } catch (error) {
        console.error("Error calling Google Veo Video API:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        onProgress(`Error: ${errorMessage}`);
        throw new Error(`Failed to generate video with Google Veo. ${errorMessage}`);
    }
};