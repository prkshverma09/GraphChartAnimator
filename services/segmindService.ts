import { getRawBase64 } from '../utils/fileUtils';

// Callback to update progress for the UI
type ProgressCallback = (message: string) => void;

const SEGMIND_URL = "https://api.segmind.com/v1/minimax-hailuo-2";

/**
 * Generates a video by animating between a start and end frame using the Segmind API.
 * @param apiKey - The Segmind API key.
 * @param startFrameDataUrl - The starting image as a full data URL.
 * @param endFrameDataUrl - The ending image as a full data URL.
 * @param onProgress - A callback function to report progress updates to the UI.
 * @returns A promise that resolves to a local blob URL for the generated video.
 */
export const generateVideo = async (
    apiKey: string,
    startFrameDataUrl: string,
    endFrameDataUrl: string,
    onProgress: ProgressCallback
): Promise<string> => {
    if (!apiKey) {
        const errorMessage = "Segmind API Key was not provided.";
        onProgress(`Error: ${errorMessage}`);
        throw new Error(errorMessage);
    }

    onProgress("Sending request to Segmind...");

    try {
        const payload = {
            "prompt": "Animate the bars on this chart growing smoothly from the start frame to the end frame.",
            // Fix: Send raw base64 data instead of the full data URL to prevent a JSON decode error on the server.
            "first_frame_image": getRawBase64(startFrameDataUrl),
            "last_frame_image": getRawBase64(endFrameDataUrl),
            "duration": 6,
            "resolution": "1080P"
        };

        const response = await fetch(SEGMIND_URL, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            let errorBody = 'An unknown error occurred';
            try {
                const errorJson = await response.json();
                errorBody = errorJson.error || errorJson.detail || errorJson.message || JSON.stringify(errorJson);
            } catch (e) {
                errorBody = await response.text();
            }
            throw new Error(`Segmind API Error: ${errorBody}`);
        }
        
        // Segmind API returns the video file directly in the response body.
        const videoBlob = await response.blob();
        const videoObjectUrl = URL.createObjectURL(videoBlob);

        onProgress("Video generation complete!");
        return videoObjectUrl;

    } catch (error) {
        console.error("Error calling Segmind Video API:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        onProgress(`Error: ${errorMessage}`);
        throw new Error(`Failed to generate video with Segmind. ${errorMessage}`);
    }
};