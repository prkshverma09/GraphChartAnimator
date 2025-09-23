import React, { useState, useCallback } from 'react';
import { FileUpload } from './components/FileUpload';
import { StepCard } from './components/StepCard';
import { ArrowDownIcon } from './components/Icons';
import { fileToBase64 } from './utils/fileUtils';
import { generateFuturisticImage, removeBarsFromImage, generateFuturisticLineChart, removeLinesFromLineChart } from './services/geminiService';
import { generateVideo as generateHailuoVideo } from './services/hailuoService';


type ProcessStep = 'idle' | 'futuristic' | 'removing_bars' | 'animating' | 'done';
type ChartType = 'bar' | 'line';

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
  const [hailuoApiKey, setHailuoApiKey] = useState<string>('');
  const [chartType, setChartType] = useState<ChartType | null>(null);


  const resetStateForNewFile = () => {
    setFuturisticImage(null);
    setFrameImage(null);
    setFinalVideoUrl(null);
    setCurrentStep('idle');
    setError(null);
    setIsLoading(false);
  };

  const handleFileChange = async (file: File | null) => {
    if (file) {
      try {
        resetStateForNewFile();
        setOriginalFile(file);
        const dataUrl = await fileToBase64(file);
        setOriginalImageDataUrl(dataUrl as string);
      } catch (err) {
        setError('Failed to read the image file.');
        setOriginalImageDataUrl(null);
        setOriginalFile(null);
      }
    }
  };
  
  const handleChartTypeChange = (newType: ChartType) => {
    setChartType(newType);
    // If a file is already uploaded when the type is changed,
    // we should clear the file and restart the process from the upload step.
    if (originalFile) {
        setOriginalFile(null);
        setOriginalImageDataUrl(null);
        resetStateForNewFile();
    }
  };

  const handleGenerate = useCallback(async () => {
    if (!originalFile || !originalImageDataUrl) {
      setError('Please upload an image first.');
      return;
    }
     if (!hailuoApiKey) {
      setError('Please enter your Hailuo AI API Key.');
      return;
    }
    
    setIsLoading(true);
    // Reset previous results but keep original image
    setFuturisticImage(null);
    setFrameImage(null);
    setFinalVideoUrl(null);
    setError(null);

    try {
      const isBarChart = chartType === 'bar';
      const animationPrompt = isBarChart 
        ? "Animate the bars on this chart growing smoothly from the start frame to the end frame."
        : "Animate this line chart, the lines should trace from left to right to reach the end frame.";

      // Step 1: Generate Futuristic Chart
      setCurrentStep('futuristic');
      const futuristicResult = isBarChart 
        ? await generateFuturisticImage(originalImageDataUrl, originalFile.type)
        : await generateFuturisticLineChart(originalImageDataUrl, originalFile.type);
      setFuturisticImage(futuristicResult);

      // Step 2: Generate Empty Frame from Futuristic Chart
      setCurrentStep('removing_bars');
      const frameResult = isBarChart
        ? await removeBarsFromImage(futuristicResult, originalFile.type)
        : await removeLinesFromLineChart(futuristicResult, originalFile.type);
      setFrameImage(frameResult);

      // Step 3: Animate with Hailuo AI
      setCurrentStep('animating');
      const videoResult = await generateHailuoVideo(
        hailuoApiKey,
        frameResult, // Start Frame
        futuristicResult, // End Frame
        setAnimationStatusMessage,
        animationPrompt
      );
      setFinalVideoUrl(videoResult);

      setCurrentStep('done');
    } catch (err) {
      console.error("Error during generation:", err);
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred during generation.';
      setError(`Generation failed. ${errorMessage}`);
      setCurrentStep('idle');
    } finally {
      setIsLoading(false);
    }
  }, [originalFile, originalImageDataUrl, chartType, hailuoApiKey]);

  const Header = () => (
     <header className="text-center mb-12">
        <h1 className="text-4xl md:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-400 to-indigo-500">
          AI Chart Animator
        </h1>
        <p className="text-gray-400 mt-4 max-w-2xl mx-auto">
          Upload a bar or line chart, and our AI will generate a stunning animation using powerful models from Google Gemini and Hailuo AI.
        </p>
      </header>
  );

  const Footer = () => (
      <footer className="text-center mt-16 text-gray-500 text-sm">
          <p>Powered by Google Gemini & Hailuo AI. Designed by a World-Class Frontend Engineer.</p>
      </footer>
  );
  
  return (
    <div className="min-h-screen bg-gray-900 text-white font-sans">
      <div className="container mx-auto px-4 py-8">
        <Header />

        {!chartType && (
          <main className="max-w-4xl mx-auto flex flex-col items-center justify-center pt-16">
            <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-2xl shadow-indigo-500/10 border border-gray-700 w-full max-w-md text-center">
              <h2 className="text-2xl font-bold text-white mb-2">Step 1: Select Chart Type</h2>
              <p className="text-gray-400 mb-6">Choose the type of chart you want to animate.</p>
              <div className="flex justify-center bg-gray-900/50 border border-gray-600 rounded-lg p-1">
                <button
                  onClick={() => handleChartTypeChange('bar')}
                  className="w-full py-2.5 text-sm font-semibold rounded-md transition-colors text-gray-300 hover:bg-gray-700"
                >
                  Bar Chart
                </button>
                <button
                  onClick={() => handleChartTypeChange('line')}
                  className="w-full py-2.5 text-sm font-semibold rounded-md transition-colors text-gray-300 hover:bg-gray-700"
                >
                  Line Chart
                </button>
              </div>
            </div>
          </main>
        )}

        {chartType && !originalFile && (
           <main className="max-w-4xl mx-auto space-y-6">
             <div className="text-center">
                <h2 className="text-2xl font-bold text-white">Step 2: Upload Your Image</h2>
                <p className="text-gray-400">You've selected <span className="font-semibold text-indigo-400">{chartType === 'bar' ? 'Bar Chart' : 'Line Chart'}</span>. Not right? <button onClick={() => setChartType(null)} className="text-indigo-400 hover:underline">Change type</button>.</p>
            </div>
            <FileUpload onFileChange={handleFileChange} disabled={isLoading} />
            {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
          </main>
        )}

        {chartType && originalFile && (
          <main className="max-w-4xl mx-auto space-y-8">
              <div className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 md:p-8 shadow-2xl shadow-indigo-500/10 border border-gray-700">
                  <div className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-400 text-center mb-3">Select Chart Type</label>
                      <div className="flex justify-center bg-gray-900/50 border border-gray-600 rounded-lg p-1 max-w-xs mx-auto">
                        <button
                          onClick={() => handleChartTypeChange('bar')}
                          disabled={isLoading}
                          className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${chartType === 'bar' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                        >
                          Bar Chart
                        </button>
                        <button
                          onClick={() => handleChartTypeChange('line')}
                          disabled={isLoading}
                          className={`w-full py-2 text-sm font-semibold rounded-md transition-colors ${chartType === 'line' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:bg-gray-700'}`}
                        >
                          Line Chart
                        </button>
                      </div>
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="hailuo-api-key" className="block text-sm font-medium text-gray-400">
                            Hailuo AI (Minimax) API Key
                        </label>
                        <input
                            type="password"
                            id="hailuo-api-key"
                            value={hailuoApiKey}
                            onChange={(e) => setHailuoApiKey(e.target.value)}
                            placeholder="Enter your API key"
                            className="w-full bg-gray-900/50 border border-gray-600 rounded-md px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            disabled={isLoading}
                        />
                    </div>
                    <div className="flex justify-center">
                        <button
                        onClick={handleGenerate}
                        disabled={isLoading || !hailuoApiKey}
                        className="inline-flex items-center justify-center px-8 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold rounded-lg shadow-lg transition-all duration-300 transform hover:scale-105 focus:outline-none focus:ring-4 focus:ring-indigo-500/50"
                        >
                        {isLoading ? 'Generating...' : 'Animate Chart'}
                        </button>
                    </div>
                  </div>
                  {error && <p className="text-red-400 mt-4 text-center">{error}</p>}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                  <StepCard
                      title="Original Image"
                      status={"completed"}
                      content={originalImageDataUrl}
                      type="image"
                  />
                  <StepCard
                      title="Step 1: Futuristic Chart (End Frame)"
                      subtitle="(Used as end frame for Hailuo AI)"
                      status={currentStep === 'futuristic' ? 'loading' : futuristicImage ? 'completed' : 'pending'}
                      loadingText="Applying futuristic style..."
                      content={futuristicImage}
                      type="image"
                      downloadFilename="futuristic-chart.png"
                  />
              </div>
              
              {(isLoading || futuristicImage) && (
                <>
                  <div className="flex justify-center">
                      <ArrowDownIcon className="w-8 h-8 text-gray-600" />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                      <StepCard
                          title="Step 2: Chart Frame (Start Frame)"
                          subtitle="(Used as start frame for Hailuo AI)"
                          status={currentStep === 'removing_bars' ? 'loading' : frameImage ? 'completed' : 'pending'}
                          loadingText="Extracting chart frame..."
                          content={frameImage}
                          type="image"
                          downloadFilename="chart-frame.png"
                      />
                      <StepCard
                          title="Step 3: Final Animation"
                          status={currentStep === 'animating' ? 'loading' : finalVideoUrl ? 'completed' : 'pending'}
                          loadingText={animationStatusMessage}
                          content={finalVideoUrl}
                          type="video"
                          downloadFilename="final-animation.mp4"
                      />
                  </div>
                </>
              )}
          </main>
        )}
        <Footer />
      </div>
    </div>
  );
};

export default App;
