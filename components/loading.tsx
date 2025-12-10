"use client";
import React from 'react';

const LoadingPage = () => {
  return (
    <div className="fixed inset-0 flex items-center justify-center z-50" style={{ backgroundColor: '#020817' }}>
      <div className="relative">

        {/* Falling Water Drops */}
        <div className="relative h-80 flex justify-center">
          {/* First Drop */}
          <div className="absolute top-0 drop-animation" style={{ animationDelay: '0s' }}>
            <div className="text-4xl drop-shadow-lg transform">
              💧
            </div>
          </div>
          
          {/* Second Drop */}
          <div className="absolute top-0 drop-animation" style={{ animationDelay: '1s' }}>
            <div className="text-4xl drop-shadow-lg transform">
              💧
            </div>
          </div>
          
          {/* Third Drop */}
          <div className="absolute top-0 drop-animation" style={{ animationDelay: '2s' }}>
            <div className="text-4xl drop-shadow-lg transform">
              💧
            </div>
          </div>
        </div>

       

        {/* Loading Text */}
        <div className="text-center mt-8">
        
          <div className="flex items-center justify-center space-x-1">
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
          <p className="text-gray-300 mt-2 text-sm">
            Loading your faucet experience...
          </p>
        </div>
      </div>

      <style jsx>{`
        .drop-animation {
          animation: dropFall 3s ease-in infinite;
        }

        @keyframes dropFall {
          0% {
            transform: translateY(0) scale(1);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          50% {
            transform: translateY(150px) scale(0.9);
            opacity: 1;
          }
          70% {
            transform: translateY(250px) scale(0.8);
            opacity: 0.8;
          }
          85% {
            transform: translateY(300px) scale(0.7);
            opacity: 0.4;
          }
          100% {
            transform: translateY(320px) scale(0.6);
            opacity: 0;
          }
        }

        .ripple {
          position: absolute;
          border: 2px solid rgba(96, 165, 250, 0.4);
          border-radius: 50%;
          animation: rippleEffect 3s ease-out infinite;
        }

        .ripple-1 {
          width: 40px;
          height: 40px;
          animation-delay: 0.85s;
        }

        .ripple-2 {
          width: 60px;
          height: 60px;
          animation-delay: 1.85s;
        }

        .ripple-3 {
          width: 80px;
          height: 80px;
          animation-delay: 2.85s;
        }

        @keyframes rippleEffect {
          0% {
            transform: translate(-50%, -50%) scale(0);
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
          }
        }

        .drop-shadow {
          filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.2));
        }
      `}</style>
    </div>
  );
};

export default LoadingPage;