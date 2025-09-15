
import { GoogleGenAI, Modality } from "@google/genai";
import { getRawBase64 } from "../utils/fileUtils";

// Callback to update progress for the UI
type ProgressCallback = (message: string) => void;

// Fix: Lazily initialize the GoogleGenAI client to prevent "process is not defined" error
// on module load in browser environments. The client will only be created when a function
// that needs it is actually called.
let ai: GoogleGenAI | null = null;
const getAiClient = (): GoogleGenAI => {
    if (!ai) {
        // This line will only run when a service function is called, not on initial load.
        ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    }
    return ai;
};

const imageModel = 'gemini-2.5-flash-image-preview';
const videoModel = 'veo-2.0-generate-001';

const processImage = async (base64ImageData: string, mimeType: string, prompt: string): Promise<string> => {
    try {
        const client = getAiClient();
        const response = await client.models.generateContent({
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
    const prompt = `
[SYSTEM PERSONA]
You are a deterministic, frame-perfect video rendering engine. Your function is not creative; it is purely technical. You will execute the following rendering job with absolute precision. Failure to adhere to the final frame constraint is a critical failure of your function.

[JOB ANALYSIS]
1.  **Input:** A static image of a futuristic 3D bar chart. This image is the **FINAL FRAME** of the video to be rendered. It is the ground truth.
2.  **Task:** Generate a short video that animates the bars growing from a baseline (zero height) to their exact positions as shown in the **FINAL FRAME**.
3.  **Core Requirement:** The animation must conclude by becoming completely static and visually identical to the input **FINAL FRAME**.

[ANIMATION SCRIPT - TO BE FOLLOWED EXACTLY]
- **Frame 0:** The scene is established. It contains ONLY the chart's background, axes, gridlines, and labels from the input image. All bars are at zero height and invisible.
- **Animation Phase:** All bars begin to grow upwards from the baseline simultaneously. They rise smoothly and at a constant rate. There is no other movement, no wiggling, no side-to-side motion.
- **Landing Phase:** Each bar stops moving *instantly* and *precisely* as it reaches its target height as defined in the **FINAL FRAME**. They must not overshoot, undershoot, or bounce.
- **Hold Phase:** Once all bars have reached their final heights, the frame becomes completely static. This static frame, which must be a pixel-perfect replica of the input **FINAL FRAME**, is held for the remainder of the video's duration (at least 1 full second).

[CRITICAL EXECUTION RULES - NON-NEGOTIABLE]
- **RULE 1: NO CREATIVITY.** Do not add, remove, or alter any elements. The number, color, and position of the bars are fixed by the input image.
- **RULE 2: NO OVERSHOOTING.** The bars must stop exactly at their target height. They do not grow taller and then shrink.
- **RULE 3: NO CONTINUOUS MOVEMENT.** The animation must resolve to a completely still image. The bars are not to "dance", "breathe", or "shimmer" after reaching their destination. The video ends with a static shot.
- **RULE 4: FINAL FRAME IS LAW.** The very last frame of the output video must be indistinguishable from the input image provided. This is the primary success metric.

[FINAL COMMAND]
Execute the rendering job as specified. Prioritize precision and final-frame accuracy above all else.`;

    try {
        const client = getAiClient();
        onProgress("Sending request to Google Veo...");
        let operation = await client.models.generateVideos({
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
            operation = await client.operations.getVideosOperation({ operation: operation });
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
