'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';
import { ProjectService } from '@/lib/project-service';
import { toast } from '@/components/ui/use-toast';

export default function ProjectPage({ params }: { params: { projectId: string } }) {
  const { projectId } = params;
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [chatHistory, setChatHistory] = useState<Array<{sender: string, text: string, contentType?: string}>>([]);
  const [input, setInput] = useState('');

  // Fetch project when user is authenticated
  useEffect(() => {
    const fetchProject = async () => {
      if (user && projectId) {
        setLoading(true);
        const { data, error } = await ProjectService.getProjectById(projectId, user.id);
        
        if (data) {
          setProject(data);
        } else if (error) {
          console.error('Error fetching project:', error);
          toast({
            title: "Error",
            description: "There was an error loading the project.",
            variant: "destructive"
          });
          router.push('/dashboard');
        }
        
        setLoading(false);
      }
    };

    if (!isLoading && !user) {
      router.push('/auth/signin');
    } else if (user) {
      fetchProject();
    }
  }, [user, projectId, router, isLoading]);

  // Handle send message
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

  // Generate content for project management
  const generateContent = (type: string) => {
    setChatHistory([...chatHistory, { 
      sender: 'ai', 
      text: `Generated ${type} for project ${projectId}`, 
      contentType: type 
    }]);
  };

  // Handle delete project
  const handleDeleteProject = async () => {
    if (confirm("Are you sure you want to delete this project? This action cannot be undone.")) {
      setIsDeleting(true);
      
      if (!user) {
        toast({
          title: "Authentication Error",
          description: "You must be logged in to delete a project",
          variant: "destructive"
        });
        return;
      }
      
      const { success, error } = await ProjectService.deleteProject(projectId, user.id);
      
      if (success) {
        toast({
          title: "Project Deleted",
          description: "The project has been deleted successfully"
        });
        router.push('/dashboard');
      } else {
        console.error('Error deleting project:', error);
        toast({
          title: "Error",
          description: "There was an error deleting the project.",
          variant: "destructive"
        });
        setIsDeleting(false);
      }
    }
  };

  // Get stakeholders from project data
  const getStakeholderNames = () => {
    if (!project || !project.project_stakeholders) return [];
    return project.project_stakeholders.map((ps: any) => ps.stakeholders.name);
  };

  // Function to convert timeline code to readable text
  const getTimelineText = (timeline: string) => {
    const timelineMap: {[key: string]: string} = {
      'less-than-month': 'Less than 1 month',
      '1-3-months': '1-3 months',
      '3-6-months': '3-6 months',
      '6-12-months': '6-12 months',
      'more-than-year': 'More than a year'
    };
    return timelineMap[timeline] || timeline;
  };

  if (loading || isLoading) {
    return <div className="flex justify-center items-center h-screen bg-gray-900 text-white">Loading...</div>;
  }
  
  if (!project) {
    return <div className="flex justify-center items-center h-screen bg-gray-900 text-white">Project not found</div>;
  }

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
          {project.name}
        </h1>
        
        {/* Action buttons */}
        <div className="flex space-x-2">
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-white hover:bg-gray-800"
            onClick={() => router.push(`/edit-project/${projectId}`)}
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-red-400 hover:bg-gray-800 hover:text-red-300"
            onClick={handleDeleteProject}
            disabled={isDeleting}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>
      
      {/* Main content - scrollable container */}
      <main className="flex-1 overflow-hidden flex flex-col items-center px-4 py-6 max-w-5xl mx-auto w-full">
        <div className="w-full max-w-3xl">
          {/* Project Summary Card */}
          <div className="bg-gray-800 rounded-lg p-6 shadow-md mb-6 w-full">
            <h2 className="text-lg font-medium mb-2 text-gray-200">Project Summary</h2>
            <div className="text-gray-300 mb-4">
              <p className="mb-2">{project.description}</p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
              <div>
                <span className="text-gray-400 block">Scale:</span>
                <span>{project.scale}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Timeline:</span>
                <span>{getTimelineText(project.timeline)}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Created:</span>
                <span>{new Date(project.created_at).toLocaleDateString()}</span>
              </div>
              <div>
                <span className="text-gray-400 block">Last Updated:</span>
                <span>{new Date(project.updated_at).toLocaleDateString()}</span>
              </div>
            </div>

            <div className="mt-4">
              <span className="text-gray-400 block mb-1">Objective:</span>
              <p className="text-gray-300">{project.objective}</p>
            </div>

            {project.additional_info && (
              <div className="mt-4">
                <span className="text-gray-400 block mb-1">Additional Information:</span>
                <p className="text-gray-300">{project.additional_info}</p>
              </div>
            )}

            <div className="mt-4">
              <span className="text-gray-400 block mb-1">Stakeholders:</span>
              <div className="flex flex-wrap gap-2">
                {getStakeholderNames().map((name: string, index: number) => (
                  <span key={index} className="bg-gray-700 px-2 py-1 rounded-full text-xs">
                    {name}
                  </span>
                ))}
              </div>
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