import React, { useRef } from 'react';
import { Loader } from './Loader';
import { DownloadIcon } from './Icons';

type StepStatus = 'pending' | 'loading' | 'completed';

interface StepCardProps {
  title: string;
  subtitle?: string;
  status: StepStatus;
  loadingText?: string;
  content: string | null;
  type: 'image' | 'video';
  downloadFilename?: string;
}

export const StepCard: React.FC<StepCardProps> = ({ title, subtitle, status, loadingText, content, type, downloadFilename }) => {
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleVideoEnded = () => {
    // Wait for 2.5 seconds before replaying
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.play();
      }
    }, 2500);
  };

  const renderContent = () => {
    if (status === 'loading') {
      return (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <Loader />
          <p className="mt-4 text-sm animate-pulse">{loadingText || 'Processing...'}</p>
        </div>
      );
    }
    if (status === 'completed' && content) {
      if (type === 'image') {
        return <img src={content} alt={title} className="w-full h-full object-contain rounded-md" />;
      }
      if (type === 'video') {
        return (
          <video
            ref={videoRef}
            src={content}
            controls
            autoPlay
            muted
            onEnded={handleVideoEnded}
            className="w-full h-full object-contain rounded-md"
          />
        );
      }
    }

    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-600">Waiting for previous step...</p>
      </div>
    );
  };

  return (
    <div className="bg-gray-800/50 rounded-lg p-4 border border-gray-700 h-80 flex flex-col">
      <div className="flex justify-between items-center mb-3">
        <div>
          <h3 className="text-lg font-semibold text-gray-300">{title}</h3>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
        {status === 'completed' && content && downloadFilename && (
          <a
            href={content}
            download={downloadFilename}
            className="text-gray-400 hover:text-white transition-colors"
            aria-label={`Download ${title}`}
            title={`Download ${title}`}
          >
            <DownloadIcon className="w-6 h-6" />
          </a>
        )}
      </div>
      <div className="flex-grow bg-gray-900/50 rounded-md flex items-center justify-center p-2 min-h-0">
        {renderContent()}
      </div>
    </div>
  );
};
