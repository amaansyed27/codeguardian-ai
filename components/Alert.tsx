
import React from 'react';

interface AlertProps {
  message: string;
}

const Alert: React.FC<AlertProps> = ({ message }) => {
  if (!message) return null;

  return (
    <div className="bg-red-900/50 border border-red-600 text-red-200 px-4 py-3 rounded-lg relative my-4 text-sm" role="alert">
      <strong className="font-bold">Error: </strong>
      <span className="block sm:inline">{message}</span>
    </div>
  );
};

export default Alert;
