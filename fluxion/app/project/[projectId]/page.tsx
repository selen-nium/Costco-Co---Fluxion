'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  ChevronLeft, 
  ChevronRight, 
  Info,
  MessageSquare,
  BarChart3,
  ListTodo,
  FileText,
  X
} from 'lucide-react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // New states for todo popup
  const [todoPopupOpen, setTodoPopupOpen] = useState(false);
  const [todoContent, setTodoContent] = useState<string>('');
  const [generateTodoLoading, setGenerateTodoLoading] = useState(false);

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

  // Function to generate todo list using the API
  const handleGenerateTodoList = async () => {
    setGenerateTodoLoading(true);
    try {
      // Create a prompt based on project details
      const prompt = `
        Generate a comprehensive todo list for the following project:
        
        Project Name: ${project.name}
        Description: ${project.description}
        Objective: ${project.objective}
        Scale: ${project.scale}
        Timeline: ${getTimelineText(project.timeline)}
        Stakeholders: ${getStakeholderNames().join(', ')}
        Additional Info: ${project.additional_info || 'N/A'}
        
        Create a detailed, actionable todo list with categorized tasks that will help successfully complete this project. 
        Include tasks for planning, execution, monitoring, and closing phases of the project.
        Format the response in markdown with headers, bullet points, and checkboxes.
      `;
  
      // Call the AI API
      const response = await fetch(`/project/${projectId}/api/chat/retrieval_agents`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            { 
              role: 'user',
              content: prompt
            }
          ],
        }),
      });
  
      if (!response.ok) {
        throw new Error('Failed to generate todo list');
      }
  
      // Check if the response is JSON or plain text
      const contentType = response.headers.get('content-type');
      let todoListContent = '';
  
      if (contentType?.includes('application/json')) {
        // Handle JSON response
        const data = await response.json();
        
        // Extract the content from the API response
        // This assumes the response follows the OpenAI-like format
        if (data.messages && data.messages.length > 0) {
          todoListContent = data.messages[data.messages.length - 1].content;
        } else if (data.choices && data.choices.length > 0) {
          todoListContent = data.choices[0].message.content;
        } else {
          todoListContent = JSON.stringify(data);
        }
      } else {
        // Handle plain text response
        todoListContent = await response.text();
      }
      
      // Set the todo content and open the popup
      setTodoContent(todoListContent);
      setTodoPopupOpen(true);
    } catch (error) {
      console.error('Error generating todo list:', error);
      toast({
        title: "Error",
        description: "There was an error generating the todo list.",
        variant: "destructive"
      });
    } finally {
      setGenerateTodoLoading(false);
    }
  };

  // Dummy function for the other generation buttons
  const handleGenerateContent = (type: string) => {
    if (type === 'Todo List') {
      handleGenerateTodoList();
    } else {
      toast({
        title: `Generating ${type}`,
        description: "This feature is not yet implemented."
      });
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
    <div className="flex h-screen bg-gray-900 text-white overflow-hidden">
      {/* Sidebar Toggle Button (Mobile) */}
      <div className="lg:hidden fixed z-20 top-20 left-0">
        <Button
          variant="ghost"
          size="sm"
          className="bg-gray-800 rounded-r-md rounded-l-none h-10 px-1"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <Info className="h-5 w-5" />}
        </Button>
      </div>

      {/* Collapsible Sidebar */}
      <div 
        className={`fixed lg:static z-10 h-full bg-gray-800 shadow-lg transition-all duration-300 ease-in-out overflow-y-auto 
        ${sidebarOpen ? 'w-64 translate-x-0' : 'w-0 -translate-x-full lg:w-64 lg:translate-x-0'}`}
      >
        <div className="sticky top-0 bg-gray-800 z-10 py-3 px-4 border-b border-gray-700 flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-200">Project Summary</h2>
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden text-gray-400 hover:bg-gray-700"
            onClick={() => setSidebarOpen(false)}
          >
            <ChevronLeft className="h-5 w-5" />
          </Button>
        </div>
        
        <div className="p-4">
          <div className="text-gray-300 mb-4">
            <p className="mb-2">{project.description}</p>
          </div>

          <div className="space-y-4 mt-4 text-sm">
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
      </div>
      
      {/* Main Content Area */}
      <div className="flex flex-col flex-1 h-full overflow-hidden">
        {/* Header */}
        <header className="border-b border-gray-700 py-3 px-4 flex items-center bg-gray-900">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="mr-4 text-white hover:bg-gray-800">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>

          {/* Toggle sidebar button (desktop) */}
          <Button
            variant="ghost"
            size="sm"
            className="mr-2 text-white hover:bg-gray-800 hidden lg:flex"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            {sidebarOpen ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
          
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
        
        {/* Main content - Project Dashboard */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-4xl mx-auto">
            {/* Project Information Card */}
            <div className="bg-gray-800 rounded-lg p-6 shadow-md mb-8">
              <h2 className="text-2xl font-bold mb-4 text-center">{project.name}</h2>
              <p className="text-gray-300 text-center mb-8">{project.description}</p>
              
              {/* Action Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
                {/* Chat Button */}
                <div className="flex flex-col items-center">
                  <Button 
                    className="w-full h-32 flex flex-col items-center justify-center bg-blue-600 hover:bg-blue-700 transition-colors duration-200"
                    onClick={() => router.push(`/project/${projectId}/chat`)}
                  >
                    <MessageSquare className="h-10 w-10 mb-2" />
                    <span className="text-lg font-medium">Start Chat</span>
                  </Button>
                  <p className="text-sm text-gray-400 mt-2 text-center">
                    Chat with your AI assistant about this project
                  </p>
                </div>
                
                {/* Gantt Chart Button */}
                <div className="flex flex-col items-center">
                  <Button 
                    className="w-full h-32 flex flex-col items-center justify-center bg-gray-700 hover:bg-gray-600 transition-colors duration-200"
                    onClick={() => handleGenerateContent('Gantt Chart')}
                  >
                    <BarChart3 className="h-10 w-10 mb-2" />
                    <span className="text-lg font-medium">Generate Gantt Chart</span>
                  </Button>
                  <p className="text-sm text-gray-400 mt-2 text-center">
                    Create a timeline visualization for your project
                  </p>
                </div>
                
                {/* Change Management Template Button */}
                <div className="flex flex-col items-center">
                  <Button 
                    className="w-full h-32 flex flex-col items-center justify-center bg-gray-700 hover:bg-gray-600 transition-colors duration-200"
                    onClick={() => handleGenerateContent('Change Management Template')}
                  >
                    <FileText className="h-10 w-10 mb-2" />
                    <span className="text-lg font-medium">Change Management Template</span>
                  </Button>
                  <p className="text-sm text-gray-400 mt-2 text-center">
                    Create a template for managing project changes
                  </p>
                </div>
                
                {/* Todo List Button */}
                <div className="flex flex-col items-center">
                  <Button 
                    className="w-full h-32 flex flex-col items-center justify-center bg-gray-700 hover:bg-gray-600 transition-colors duration-200"
                    onClick={() => handleGenerateContent('Todo List')}
                    disabled={generateTodoLoading}
                  >
                    {generateTodoLoading ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                        <span className="text-lg font-medium">Generating...</span>
                      </div>
                    ) : (
                      <>
                        <ListTodo className="h-10 w-10 mb-2" />
                        <span className="text-lg font-medium">Generate Todo List</span>
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-gray-400 mt-2 text-center">
                    Create a todo list for the project manager
                  </p>
                </div>
              </div>
            </div>
            
            {/* Quick Stats Section */}
            <div className="bg-gray-800 rounded-lg p-6 shadow-md">
              <h3 className="text-xl font-medium mb-4">Project Overview</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="border border-gray-700 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Project Scale</div>
                  <div className="text-xl font-bold">{project.scale}</div>
                </div>
                <div className="border border-gray-700 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Timeline</div>
                  <div className="text-xl font-bold">{getTimelineText(project.timeline)}</div>
                </div>
                <div className="border border-gray-700 rounded-lg p-4">
                  <div className="text-gray-400 text-sm mb-1">Stakeholders</div>
                  <div className="text-xl font-bold">{getStakeholderNames().length}</div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Todo List Popup */}
      {todoPopupOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Popup Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
              <h3 className="text-xl font-medium">Todo List</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                onClick={() => setTodoPopupOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Popup Content */}
            <div className="p-6 overflow-y-auto flex-grow">
              {/* Todo content with Markdown rendering */}
              <div 
                className="prose prose-invert max-w-none"
                dangerouslySetInnerHTML={{ 
                  __html: todoContent.replace(/\n/g, '<br>')
                    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                    .replace(/\*(.*?)\*/g, '<em>$1</em>')
                    .replace(/# (.*?)(\n|$)/g, '<h1>$1</h1>')
                    .replace(/## (.*?)(\n|$)/g, '<h2>$1</h2>')
                    .replace(/### (.*?)(\n|$)/g, '<h3>$1</h3>')
                    .replace(/- \[ \] (.*?)(\n|$)/g, '<div class="flex items-start mb-2"><input type="checkbox" class="mt-1 mr-2" /><div>$1</div></div>')
                    .replace(/- \[x\] (.*?)(\n|$)/g, '<div class="flex items-start mb-2"><input type="checkbox" checked class="mt-1 mr-2" /><div>$1</div></div>')
                    .replace(/- (.*?)(\n|$)/g, '<div class="flex items-start mb-2"><span class="mr-2">•</span><div>$1</div></div>')
                }}
              />
            </div>
            
            {/* Popup Footer */}
            <div className="px-6 py-4 border-t border-gray-700 flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setTodoPopupOpen(false)}
              >
                Close
              </Button>
              <Button 
                className="bg-blue-600 hover:bg-blue-700"
                onClick={() => {
                  // Create a blob with the todo content
                  const blob = new Blob([todoContent], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  
                  // Create a download link and click it
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `${project.name.replace(/\s+/g, '-').toLowerCase()}-todo-list.md`;
                  document.body.appendChild(a);
                  a.click();
                  
                  // Clean up
                  setTimeout(() => {
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  }, 0);
                }}
              >
                Download
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}