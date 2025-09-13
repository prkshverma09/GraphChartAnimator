
import React, { useState, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { StepCard } from './components/StepCard';
import { ArrowDownIcon, MagicWandIcon } from './components/Icons';
import { generateFuturisticImage, removeBarsFromImage } from './services/geminiService';
import { generateVideo } from './services/hailuoService';
import { fileToBase64 } from './utils/fileUtils';

type ProcessStep = 'idle' | 'futuristic' | 'removing_bars' | 'animating' | 'done';

const App: React.FC = () => {
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [originalImageDataUrl, setOriginalImageDataUrl] = useState<string | null>(null);
  const [futuristicImage, setFuturisticImage] = useState<string | null>(null);
  const [frameImage, setFrameImage] = useState<string | null>(null);
  const [finalVideoUrl, setFinalVideoUrl] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [currentStep, setCurrentStep] = useState<ProcessStep>('idle');
  const [animationStatusMessage, setAnimationStatusMessage] = useState<string>("Generating animated video...");
  const [error, setError] = useState<string | null>(null);

  const resetState = () => {
    setFuturisticImage(null);
    setFrameImage(null);
    setFinalVideoUrl(null);
    setCurrentStep('idle');
    setError(null);
  };

  const handleFileChange = async (file: File | null) => {
    setOriginalFile(file);
    resetState();
    if (file) {
      try {
        const dataUrl = await fileToBase64(file);
        setOriginalImageDataUrl(dataUrl as string);
      } catch (err) {
        setError('Failed to read the image file.');
        setOriginalImageDataUrl(null);
      }
    } else {
      setOriginalImageDataUrl(null);
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!originalFile || !originalImageDataUrl) {
      setError('Please upload an image first.');
      return;
    }

    setIsLoading(true);
    resetState();
    setAnimationStatusMessage("Generating animated video...");

    try {
      // Step 1: Make the bar chart futuristic
      setCurrentStep('futuristic');
      const futuristicResult = await generateFuturisticImage(originalImageDataUrl, originalFile.type);
      setFuturisticImage(futuristicResult);

      // Step 2: Remove bars from the futuristic chart
      setCurrentStep('removing_bars');
      const frameResult = await removeBarsFromImage(futuristicResult, originalFile.type);
      setFrameImage(frameResult);

      // Step 3: Animate using Hailuo AI
      setCurrentStep('animating');
      const videoUrl = await generateVideo(frameResult, futuristicResult, (message: string) => {
          setAnimationStatusMessage(message);
      });
      setFinalVideoUrl(videoUrl);

      setCurrentStep('done');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
      setCurrentStep('idle'); // Reset on failure
    } finally {
      setIsLoading(false);
    }
  }, [originalFile, originalImageDataUrl]);

  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-500">
            AI Bar Chart Animator
          </h1>
          <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
            Upload a bar chart, and our AI will generate a stunning animation using Google Gemini and Hailuo AI.
          </p>
        </header>

        <main className="max-w-4xl mx-auto">
          <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 md:p-8 shadow-2xl shadow-indigo-500/10 border border-gray-700">
            <FileUpload onFileChange={handleFileChange} disabled={isLoading} />
            {originalFile && (
              <div className="mt-6 flex flex-col items-center gap-4">
                <button
                  onClick={handleGenerate}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
                >
                  <MagicWandIcon className="w-5 h-5 mr-2" />
                  {isLoading ? 'Generating...' : 'Animate Chart'}
                </button>
              </div>
            )}
            {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
          </div>
          
          <div className="mt-12 space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                <StepCard
                    title="Original Image"
                    status={originalImageDataUrl ? "completed" : "pending"}
                    content={originalImageDataUrl}
                    type="image"
                />
                <StepCard
                    title="Step 1: Futuristic Chart (End Frame)"
                    status={futuristicImage ? 'completed' : currentStep === 'futuristic' ? 'loading' : 'pending'}
                    loadingText="Applying futuristic style..."
                    content={futuristicImage}
                    type="image"
                    downloadFilename="futuristic-chart.png"
                />
            </div>

            <div className="flex justify-center">
                <ArrowDownIcon className="w-8 h-8 text-gray-600" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                 <StepCard
                    title="Step 2: Chart Frame (Start Frame)"
                    status={frameImage ? 'completed' : currentStep === 'removing_bars' ? 'loading' : 'pending'}
                    loadingText="Extracting chart frame..."
                    content={frameImage}
                    type="image"
                    downloadFilename="chart-frame.png"
                />
                 <StepCard
                    title="Step 3: Final Animation"
                    status={finalVideoUrl ? 'completed' : currentStep === 'animating' ? 'loading' : 'pending'}
                    loadingText={animationStatusMessage}
                    content={finalVideoUrl}
                    type="video"
                    downloadFilename="final-animation.mp4"
                />
            </div>
          </div>
        </main>

         <footer className="text-center mt-16 text-gray-500 text-sm">
            <p>Powered by Google Gemini & Hailuo AI. Designed by a World-Class Frontend Engineer.</p>
        </footer>
      </div>
    </div>
  );
};

export default App;
