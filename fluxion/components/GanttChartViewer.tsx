'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';

const Mermaid = dynamic(() => import('react-mermaid2'), { ssr: false });

export default function GanttChartViewer({ chart }: { chart: string }) {
  const [isClient, setIsClient] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsClient(true);
  }, []);

  const enhancedChart = `
  %%{init: {
    "theme": "default",
    "gantt": {
        "axisFormat": "%m-%d",
        "axisFontSize": 14,
        "barHeight": 40,
        "barGap": 10,
        "topPadding": 60,
        "leftPadding": 150,
        "fontSize": 16,
        "sectionFontSize": 18
    }
  }}%%
  ${chart.trim()}
  `;

  const handleDownload = () => {
    const svg = containerRef.current?.querySelector('svg');
    if (!svg) return;
  
    const svgData = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(svgBlob);
  
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
  
      // 🔽 Set white background before drawing the image
      if (ctx) {
        ctx.fillStyle = '#ffffff'; // Set background to white
        ctx.fillRect(0, 0, canvas.width, canvas.height); // Fill canvas
        ctx.drawImage(img, 0, 0); // Draw SVG image
      }
  
      URL.revokeObjectURL(url);
      const pngUrl = canvas.toDataURL('image/png');
  
      const a = document.createElement('a');
      a.href = pngUrl;
      a.download = 'gantt-chart.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    };
    img.src = url;
  };
  
  if (!isClient) return null;

  return (
    <div className="overflow-x-auto bg-white text-black p-4 rounded shadow">
      <div ref={containerRef}>
        <Mermaid chart={enhancedChart} />
      </div>

      <div className="flex justify-end mt-4">
        <button
          onClick={handleDownload}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
        >
          Download as PNG
        </button>
      </div>
    </div>
  );
}
