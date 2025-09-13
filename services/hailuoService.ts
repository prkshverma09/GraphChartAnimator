
// Callback to update progress for the UI
type ProgressCallback = (message: string) => void;

const GENERATE_URL = "https://api.minimax.chat/v1/video/generate";
const RETRIEVE_URL = "https://api.minimax.chat/v1/video/retrieve";

const getRawBase64 = (dataUrl: string): string => {
    const parts = dataUrl.split(',');
    if (parts.length > 1) {
        return parts[1];
    }
    return dataUrl;
}

/**
 * Generates a video by animating between a start and end frame using the Hailuo AI API.
 * @param startFrameDataUrl - The starting image as a data URL.
 * @param endFrameDataUrl - The ending image as a data URL.
 * @param apiKey - The user's Hailuo AI API key.
 * @param onProgress - A callback function to report progress updates to the UI.
 * @returns A promise that resolves to a URL for the generated video.
 */
export const generateVideo = async (
    startFrameDataUrl: string, 
    endFrameDataUrl: string,
    apiKey: string,
    onProgress: ProgressCallback
): Promise<string> => {
    console.log("Hailuo AI Service: Starting video generation.");

    if (!apiKey) {
        throw new Error("Hailuo AI API key is not provided.");
    }

    const startFrameBase64 = getRawBase64(startFrameDataUrl);
    const endFrameBase64 = getRawBase64(endFrameDataUrl);

    try {
        onProgress("Sending request to Hailuo AI...");
        
        // Step 1: Start the video generation task
        const generateResponse = await fetch(GENERATE_URL, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                start_frame: startFrameBase64,
                end_frame: endFrameBase64,
                // Additional parameters can be added here based on documentation
            }),
        });

        if (!generateResponse.ok) {
            const errorBody = await generateResponse.json();
            throw new Error(`Hailuo API Error: ${errorBody.base?.message || generateResponse.statusText}`);
        }

        const generateResult = await generateResponse.json();
        const taskId = generateResult.task_id;

        if (!taskId) {
            throw new Error("Failed to get a task ID from Hailuo AI.");
        }

        onProgress("Task created. Polling for video result...");

        // Step 2: Poll for the result
        let pollingAttempts = 0;
        const maxAttempts = 60; // Poll for up to 5 minutes (60 attempts * 5 seconds)

        while (pollingAttempts < maxAttempts) {
            pollingAttempts++;
            await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds

            onProgress(`Checking video status... (Attempt ${pollingAttempts})`);

            const retrieveResponse = await fetch(`${RETRIEVE_URL}?task_id=${taskId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
            });
            
            if (!retrieveResponse.ok) {
                // Continue polling even if one check fails, but log it
                console.warn(`Polling failed on attempt ${pollingAttempts}: ${retrieveResponse.statusText}`);
                continue;
            }

            const retrieveResult = await retrieveResponse.json();

            if (retrieveResult.status === "completed") {
                onProgress("Video generation complete!");
                if (!retrieveResult.video_url) {
                    throw new Error("Video generation completed, but no video URL was returned.");
                }
                return retrieveResult.video_url;
            } else if (retrieveResult.status === "failed") {
                throw new Error(`Video generation failed: ${retrieveResult.error?.message || 'Unknown reason'}`);
            }
            // If status is "processing", the loop will continue
        }

        throw new Error("Video generation timed out. The task took too long to complete.");

    } catch (error) {
        console.error("Error calling Hailuo AI Video API:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        onProgress(`Error: ${errorMessage}`);
        throw new Error(`Failed to generate video with Hailuo AI. ${errorMessage}`);
    }
};
