'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

// Mock function - replace with actual data fetching
const fetchProjectData = async (id) => {
  // Replace with actual API call
  return {
    id,
    title: `Project ${id}`,
    summary: `This is a detailed summary of project ${id}...`,
    lastEdited: 'Yesterday'
  };
};

export default function ProjectPage({ params }) {
  const { projectId } = params;
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatHistory, setChatHistory] = useState([]);
  const [input, setInput] = useState('');

  useEffect(() => {
    const getProjectData = async () => {
      try {
        const data = await fetchProjectData(projectId);
        setProject(data);
      } catch (error) {
        console.error('Error fetching project:', error);
      } finally {
        setLoading(false);
      }
    };
    
    getProjectData();
  }, [projectId]);

  const handleSendMessage = () => {
    if (!input.trim()) return;
    
    setChatHistory([...chatHistory, { sender: 'user', text: input }]);
    setInput('');
    
    // Simulate AI response
    setTimeout(() => {
      setChatHistory(prev => [...prev, { 
        sender: 'ai', 
        text: `Response to: ${input}` 
      }]);
    }, 1000);
  };

  const generateContent = (type) => {
    setChatHistory([...chatHistory, { 
      sender: 'ai', 
      text: `Generated ${type} for project ${projectId}`, 
      contentType: type 
    }]);
  };

  if (loading) return <div className="flex justify-center items-center h-screen bg-gray-900 text-white">Loading...</div>;
  if (!project) return <div className="flex justify-center items-center h-screen bg-gray-900 text-white">Project not found</div>;

  return (
    <div className="flex flex-col h-screen bg-white-900 text-white overflow-hidden">
      {/* Header */}
      <header className="border-b border-white-700 py-3 px-4 flex items-center bg-gray-900">
        <Link href="/dashboard">
          <Button variant="ghost" size="sm" className="mr-4 text-white hover:bg-gray-800">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>
        </Link>
        {/* Empty div to push title to center */}
        <div className="flex-1"></div>
        
        {/* Centered title */}
        <h1 className="text-xl font-bold text-center text-white absolute left-1/2 transform -translate-x-1/2">
          {project.title}
        </h1>
        
        {/* Empty div for balance */}
        <div className="flex-1"></div>
      </header>
      
      {/* Main content - scrollable container */}
      <main className="flex-1 overflow-hidden flex flex-col items-center px-4 py-6 max-w-5xl mx-auto w-full">
        <div className="w-full max-w-3xl">
          {/* Project Summary Card */}
          <div className="bg-gray-800 rounded-lg p-6 shadow-md mb-6 w-full">
            <h2 className="text-lg font-medium mb-2 text-gray-200">Project Summary</h2>
            <div className="text-gray-300 max-h-48 overflow-y-auto">
              {project.summary}
            </div>
          </div>
          
          {/* Chat history - scrollable */}
          <div className="bg-gray-800 rounded-lg p-4 mb-4 min-h-[300px] max-h-[calc(100vh-350px)] overflow-y-auto w-full">
            {chatHistory.map((message, index) => (
              <div 
                key={index} 
                className={`mb-4 ${message.sender === 'user' ? 'text-right' : 'text-left'}`}
              >
                <div 
                  className={`inline-block p-3 rounded-lg max-w-[80%] ${
                    message.sender === 'user' 
                      ? 'bg-blue-600 text-white' 
                      : 'bg-gray-700 text-gray-200'
                  }`}
                >
                  {message.text}
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>
      
      {/* Chat interface fixed at bottom */}
      <footer className="border-t border-gray-700 p-4 bg-gray-900">
        <div className="max-w-3xl mx-auto w-full">
          {/* Action buttons - larger size */}
          <div className="flex space-x-3 mb-4 justify-center">
            <Button 
              variant="outline" 
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700 px-4 py-2 h-15 text-sm"
              onClick={() => generateContent('template')}
            >
              Generate Template
            </Button>
            <Button 
              variant="outline" 
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700 px-4 py-2 h-15 text-sm"
              onClick={() => generateContent('gantt')}
            >
              Gantt Chart
            </Button>
            <Button 
              variant="outline" 
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700 px-4 py-2 h-15 text-sm"
              onClick={() => generateContent('checklist')}
            >
              Checklist
            </Button>
            <Button 
              variant="outline" 
              className="bg-gray-800 text-white border-gray-700 hover:bg-gray-700 px-4 py-2 h-15 text-sm"
            >
              Chat History
            </Button>
          </div>
          
          {/* Input area */}
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your project..."
              className="flex-1 p-2 rounded-lg bg-gray-800 text-white border border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500 h-10"
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
            />
            <Button 
              onClick={handleSendMessage}
              className="bg-blue-600 hover:bg-blue-700 text-white h-10 px-5"
            >
              Send
            </Button>
          </div>
        </div>
      </footer>
    </div>
  );
}