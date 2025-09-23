// Callback to update progress for the UI
type ProgressCallback = (message: string) => void;

const GENERATE_URL = "https://api.minimax.io/v1/video_generation";
const QUERY_TASK_URL = "https://api.minimax.io/v1/query/video_generation";
const RETRIEVE_FILE_URL = "https://api.minimax.io/v1/files/retrieve";


// Helper function for polling delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));


/**
 * Generates a video by animating between a start and end frame using the Hailuo AI API.
 * This function handles the asynchronous nature of the API by first creating a task,
 * polling for its completion, and then retrieving the final video download URL.
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

    // --- Step 1: Create the video generation task ---
    onProgress("Sending request to Hailuo AI to create video task...");
    let taskId: string;
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
        
        if (result.base_resp?.status_code !== 0 || !result.task_id) {
            throw new Error(`Failed to create task. ${result.base_resp?.status_msg || 'Unknown API error'}`);
        }
        
        taskId = result.task_id;
        onProgress(`Task created (ID: ${taskId}). Polling for status...`);
    } catch (error) {
        console.error("Error creating Hailuo AI video task:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        onProgress(`Error: ${errorMessage}`);
        throw new Error(`Failed to start video generation with Hailuo AI. ${errorMessage}`);
    }

    // --- Step 2: Poll for the task result to get file_id ---
    let fileId: string;
    try {
        let pollingAttempts = 0;
        const maxAttempts = 90; // Poll for ~7.5 minutes (90 attempts * 5 seconds)

        while (pollingAttempts < maxAttempts) {
            pollingAttempts++;
            await sleep(5000); // Wait 5 seconds between polls

            onProgress(`Checking task status... (Attempt ${pollingAttempts}/${maxAttempts})`);

            const queryResponse = await fetch(`${QUERY_TASK_URL}?task_id=${taskId}`, {
                method: 'GET', // Corrected: Use GET for querying task status as per successful curl test.
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                },
            });

            if (!queryResponse.ok) {
                console.warn(`Polling request failed with status ${queryResponse.status}. Retrying...`);
                continue;
            }

            const queryResult = await queryResponse.json();

            if (queryResult.base_resp?.status_code !== 0) {
                throw new Error(`API error during polling: ${queryResult.base_resp.status_msg}`);
            }

            const status = queryResult.status;

            if (status === 'Success') {
                if (!queryResult.file_id) {
                    throw new Error("Task succeeded, but the API did not return a file_id.");
                }
                onProgress("Task complete. Retrieving video file...");
                fileId = queryResult.file_id;
                break; // Exit the polling loop
            } else if (status === 'Fail') {
                throw new Error(`Video generation failed. Reason: ${queryResult.error_msg || 'Unknown error from API.'}`);
            }
            
            if (pollingAttempts >= maxAttempts) {
                 throw new Error("Video generation timed out. The task took too long to complete.");
            }
        }
    } catch (error) {
        console.error("Error polling Hailuo AI Video API:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        onProgress(`Error: ${errorMessage}`);
        throw new Error(`Failed to check task status with Hailuo AI. ${errorMessage}`);
    }

    // --- Step 3: Retrieve the video download URL using file_id ---
    try {
        const retrieveResponse = await fetch(`${RETRIEVE_FILE_URL}?file_id=${fileId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
        });

        if (!retrieveResponse.ok) {
            throw new Error(`Failed to retrieve file details. Status: ${retrieveResponse.status}`);
        }

        const retrieveResult = await retrieveResponse.json();

        if (retrieveResult.base_resp?.status_code !== 0) {
            throw new Error(`API error retrieving file: ${retrieveResult.base_resp.status_msg}`);
        }

        const downloadUrl = retrieveResult.file?.download_url;
        if (!downloadUrl) {
            throw new Error("File details retrieved, but no download_url was found.");
        }
        
        onProgress("Video generation complete!");
        return downloadUrl;

    } catch (error) {
        console.error("Error retrieving video file from Hailuo AI:", error);
        const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
        onProgress(`Error: ${errorMessage}`);
        throw new Error(`Failed to retrieve video file from Hailuo AI. ${errorMessage}`);
    }
};