
import React from 'react';
import { Loader } from './Loader';

type StepStatus = 'pending' | 'loading' | 'completed';

interface StepCardProps {
  title: string;
  status: StepStatus;
  loadingText?: string;
  content: string | null;
  type: 'image' | 'video';
}

export const StepCard: React.FC<StepCardProps> = ({ title, status, loadingText, content, type }) => {
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
        return <video src={content} controls autoPlay loop className="w-full h-full object-contain rounded-md" />;
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
      <h3 className="text-lg font-semibold text-gray-300 mb-3">{title}</h3>
      <div className="flex-grow bg-gray-900/50 rounded-md flex items-center justify-center p-2 min-h-0">
        {renderContent()}
      </div>
    </div>
  );
};
