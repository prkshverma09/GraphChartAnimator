// Callback to update progress for the UI
type ProgressCallback = (message: string) => void;

const GENERATE_URL = "https://api.minimax.io/v1/video_generation";

/**
 * Generates a video by animating between a start and end frame using the Hailuo AI API.
 * This function uses the synchronous MiniMax-Hailuo-02 model.
 * @param apiKey - The Hailuo AI API key.
 * @param startFrameDataUrl - The starting image as a full data URL.
 * @param endFrameDataUrl - The ending image as a full data URL.
 * @param onProgress - A callback function to report progress updates to the UI.
 * @param prompt - The specific animation prompt to use for the video generation.
 * @returns A promise that resolves to a URL for the generated video.
 */
export const generateVideo = async (
    apiKey: string,
    startFrameDataUrl: string,
    endFrameDataUrl: string,
    onProgress: ProgressCallback,
    prompt: string
): Promise<string> => {
    if (!apiKey) {
        const errorMessage = "Hailuo AI API Key was not provided.";
        onProgress(`Error: ${errorMessage}`);
        throw new Error(errorMessage);
    }

    onProgress("Sending request to Hailuo AI...");

    try {
        const payload = {
            model: "MiniMax-Hailuo-02",
            prompt: prompt,
            first_frame_image: startFrameDataUrl,
            last_frame_image: endFrameDataUrl,
            duration: 6,
            resolution: "1080P"
        };

        const response = await fetch(GENERATE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        const result = await response.json();

        // Check for API-level errors indicated in the response body
        if (result.base_resp && result.base_resp.status_code !== 0) {
            throw new Error(`Hailuo API Error: ${result.base_resp.status_msg}`);
        }

        // Check for network/HTTP errors
        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}. Message: ${result.base_resp?.status_msg || response.statusText}`);
        }

        if (!result.video_url) {
            throw new Error("Video generation may have succeeded, but no video URL was returned.");
        }

        onProgress("Video generation complete!");
        return result.video_url;

    } catch (error) {
        console.error("Error calling Hailuo AI Video API:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        onProgress(`Error: ${errorMessage}`);
        throw new Error(`Failed to generate video with Hailuo AI. ${errorMessage}`);
    }
};
