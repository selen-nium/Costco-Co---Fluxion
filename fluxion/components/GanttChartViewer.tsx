'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const Mermaid = dynamic(() => import('react-mermaid2'), { ssr: false });

export default function GanttChartViewer({ chart }: { chart: string }) {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
  }, []);

  if (!isClient) return null;

  // Inject config *into* the Mermaid chart string itself
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



  return (
    <div className="overflow-x-auto bg-white text-black p-4 rounded shadow">
      <Mermaid chart={enhancedChart} />
    </div>
  );
}
