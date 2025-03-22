'use client';
import GanttChartViewer from '@/components/GanttChartViewer';
import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
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
import html2pdf from 'html2pdf.js';
import GanttChartViewer from '@/components/GanttChartViewer';

export default function ProjectPage({ params }: { params: Promise<{ projectId: string }> }) {
  // Unwrap the params using React.use()
  const { projectId } = use(params);
  
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const [project, setProject] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // States for popups
  const [todoPopupOpen, setTodoPopupOpen] = useState(false);
  const [ganttChartPopupOpen, setGanttChartPopupOpen] = useState(false);
  const [changeManagementPopupOpen, setChangeManagementPopupOpen] = useState(false);
  
  // States for content
  const [todoContent, setTodoContent] = useState<string>('');
  const [ganttChartContent, setGanttChartContent] = useState<string>('');
  const [changeManagementContent, setChangeManagementContent] = useState<string>('');
  
  // New states for stakeholder guides
  const [stakeholderGuides, setStakeholderGuides] = useState<{[key: string]: string}>({});
  const [selectedStakeholder, setSelectedStakeholder] = useState<string>('');
  
  // Loading states
  const [generateTodoLoading, setGenerateTodoLoading] = useState(false);
  const [generateGanttChartLoading, setGenerateGanttChartLoading] = useState(false);
  const [generateChangeManagementLoading, setGenerateChangeManagementLoading] = useState(false);

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

  // Updated function to generate stakeholder guides
  const handleGenerateStakeholderGuides = async () => {
    setGenerateTodoLoading(true);
    try {
      // Create a clearer, more focused prompt
      const prompt = `
        # Change Management Stakeholder Guide Generator

        ## Project Context
        Project Name: ${project.name}
        Description: ${project.description}
        Objective: ${project.objective}
        Scale: ${project.scale}
        Timeline: ${getTimelineText(project.timeline)}
        Additional Info: ${project.additional_info || 'N/A'}

        ## Stakeholders Involved
        ${getStakeholderNames().map(name => `- ${name}`).join('\n')}

        ## Task Description
        For EACH of the stakeholders listed above(apart from 'Stakeholder'), create a separate guide document. Each guide should be clearly separated with a marker like "=== STAKEHOLDER GUIDE: [Stakeholder Name] ===" at the beginning and "=== END OF GUIDE ===" at the end of each guide.

        ## For each stakeholder guide, please include:

        1. **Role and Responsibilities**
          - Clear definition of the stakeholder's role in the change process
          - Specific responsibilities and action items
          - Key decision points they're involved in

        2. **Detailed Implementation Checklist**
          - Pre-implementation preparation tasks
          - Implementation phase action items
          - Post-implementation follow-up responsibilities
          - Each item should include an estimated time commitment

        3. **Timeline and Key Milestones**
          - Visual description of when their involvement is needed
          - Critical dates and deadlines specific to their role
          - Dependencies with other stakeholders' activities
          - Regular check-in points and progress reviews

        4. **Potential Risks and Resistance Factors**
          - Identification of likely challenges specific to this stakeholder
          - Common resistance patterns they might encounter (or exhibit)
          - Early warning signs to monitor

        5. **Mitigation Strategies**
          - Practical approaches to address identified risks
          - Communication templates and talking points
          - Escalation procedures when issues arise
          - Resources available for additional support

        6. **Success Metrics**
          - How this stakeholder's contribution to the change will be measured
          - KPIs relevant to their role
          - Feedback mechanisms they should implement

        7. **Communication Plan**
          - Who they need to communicate with

        Format each guide professionally with clear sections and subsections, using markdown formatting.
        Ensure each guide is tailored to the specific perspective and responsibilities of that stakeholder.
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
        throw new Error('Failed to generate stakeholder guides');
      }

      // Process the response
      const contentType = response.headers.get('content-type');
      let fullContent = '';

      if (contentType?.includes('application/json')) {
        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          fullContent = data.messages[data.messages.length - 1].content;
        } else if (data.choices && data.choices.length > 0) {
          fullContent = data.choices[0].message.content;
        } else {
          fullContent = JSON.stringify(data);
        }
      } else {
        fullContent = await response.text();
      }
      
      // Parse the content to separate stakeholder guides
      const guides: {[key: string]: string} = {};
      
      // Split the content by the stakeholder guide markers
      const guideMatches = fullContent.split(/===\s*STAKEHOLDER GUIDE:\s*(.*?)\s*===/);
      
      // Starting from index 1, process each guide (the array will have format [preamble, name1, content1, name2, content2, ...])
      for (let i = 1; i < guideMatches.length; i += 2) {
        if (i + 1 < guideMatches.length) {
          const stakeholderName = guideMatches[i].trim();
          let guideContent = guideMatches[i + 1];
          
          // Remove the end marker if it exists
          guideContent = guideContent.replace(/===\s*END OF GUIDE\s*===/g, '').trim();
          
          guides[stakeholderName] = guideContent;
        }
      }
      
      // If no guides were properly separated, try an alternative parsing approach
      if (Object.keys(guides).length === 0) {
        const stakeholderNames = getStakeholderNames();
        for (const name of stakeholderNames) {
          // Try to find sections that might correspond to each stakeholder
          const regex = new RegExp(`(?:#+\\s*${name}|${name}[\\s\\S]*?(?=(?:#+\\s*(?:${stakeholderNames.join('|')})|$))`, 'i');
          const match = fullContent.match(regex);
          if (match && match[0]) {
            guides[name] = match[0].trim();
          }
        }
        
        // If still no guides, just use the full content for the first stakeholder
        if (Object.keys(guides).length === 0 && stakeholderNames.length > 0) {
          guides[stakeholderNames[0]] = fullContent;
        }
      }
      
      setStakeholderGuides(guides);
      
      // If guides were created, select the first one and open the popup
      const stakeholderList = Object.keys(guides);
      if (stakeholderList.length > 0) {
        setSelectedStakeholder(stakeholderList[0]);
        setTodoContent(guides[stakeholderList[0]]);
        setTodoPopupOpen(true);
      } else {
        // If parsing failed, just show the full content
        setTodoContent(fullContent);
        setTodoPopupOpen(true);
      }
    } catch (error) {
      console.error('Error generating stakeholder guides:', error);
      toast({
        title: "Error",
        description: "There was an error generating the stakeholder guides.",
        variant: "destructive"
      });
    } finally {
      setGenerateTodoLoading(false);
    }
  };

  // Function to generate Gantt chart
  const handleGenerateGanttChart = async () => {
    setGenerateGanttChartLoading(true);
    try {
      // Create a prompt based on project details
      const prompt = `
      Generate a Gantt chart using Mermaid syntax for the following project.
      
      Project Name: ${project.name}
      Description: ${project.description}
      Objective: ${project.objective}
      Scale: ${project.scale}
      Timeline: ${getTimelineText(project.timeline)}
      Stakeholders: ${getStakeholderNames().join(', ')}
      Additional Info: ${project.additional_info || 'N/A'}
    
      Requirements:
      - The chart should include the following phases: Planning, Execution, Monitoring, and Closing.
      - Use realistic task durations and dependencies based on the timeline provided.
      - Mermaid version is 8.14.0. Ensure strict compatibility.
      - The date starts with 2025-03-23
      - **DO NOT use spaces in task names**. Replace them with underscores or use quoted labels.
      - Use this format for each task: Label :id, start_date or dependency, duration
      - Example:
        section Planning
        "Project_Setup" :a1, 2025-03-23, 3d
        "Team_Alignment" :a2, after a1, 2d
    
      Output ONLY the raw Mermaid chart with no explanation or code block formatting.
      Begin with \`gantt\`, then define \`dateFormat\`, \`title\`, and the chart body.
<<<<<<< HEAD
      `;
=======
    `;
    
>>>>>>> 53b34be31ed75ca67148596f14fb9159a235d186
  
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
        throw new Error('Failed to generate Gantt chart');
      }
  
      // Process the response
      const contentType = response.headers.get('content-type');
      let ganttChartContent = '';
  
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          ganttChartContent = data.messages[data.messages.length - 1].content;
        } else if (data.choices && data.choices.length > 0) {
          ganttChartContent = data.choices[0].message.content;
        } else {
          ganttChartContent = JSON.stringify(data);
        }
      } else {
        ganttChartContent = await response.text();
      }
      
      setGanttChartContent(ganttChartContent);
      setGanttChartPopupOpen(true);
    } catch (error) {
      console.error('Error generating Gantt chart:', error);
      toast({
        title: "Error",
        description: "There was an error generating the Gantt chart.",
        variant: "destructive"
      });
    } finally {
      setGenerateGanttChartLoading(false);
    }
  };

  // Function to generate change management template
  const handleGenerateChangeManagement = async () => {
    setGenerateChangeManagementLoading(true);
    try {
      // Create a prompt based on project details
      const prompt = `
        Fill out a change management template for the following project:
        
        Project Name: ${project.name}
        Description: ${project.description}
        Objective: ${project.objective}
        Scale: ${project.scale}
        Timeline: ${getTimelineText(project.timeline)}
        Stakeholders: ${getStakeholderNames().join(', ')}
        Additional Info: ${project.additional_info || 'N/A'}
        
        Use this template structure:
        
        # CHANGE MANAGEMENT PLAN
        
        ## 1. Project Overview
        Project Name: 
        Purpose of Change: 
        Expected Outcomes: 
        
        ## 2. Define Success
        Success Criteria: 
        Stakeholders Involved: 
        
        ## 3. Change Impact Assessment
        Impacted Groups: 
        Change Characteristics: 
        
        ## 4. Change Management Strategy
        Key Messages: 
        Engagement Tactics: 
        
        ## 5. Communications Plan
        Communication Objectives: 
        Target Audiences: 
        Communication Channels: 
        
        ## 6. Resistance Management
        Potential Resistance Points: 
        Strategies to Prevent and Address Resistance: 
        
        ## 7. Implementation Timeline
        Milestones: 
        Responsibilities: 
        
        ## 8. Monitoring and Evaluation
        Performance Metrics: 
        Feedback Mechanisms: 
        
        ## 9. Sustain Outcomes
        Sustainment Strategies: 
        Ownership Transfer: 
        
        Fill each section with detailed and practical information specific to this project.
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
        throw new Error('Failed to generate change management template');
      }
  
      // Process the response
      const contentType = response.headers.get('content-type');
      let templateContent = '';
  
      if (contentType?.includes('application/json')) {
        const data = await response.json();
        
        if (data.messages && data.messages.length > 0) {
          templateContent = data.messages[data.messages.length - 1].content;
        } else if (data.choices && data.choices.length > 0) {
          templateContent = data.choices[0].message.content;
        } else {
          templateContent = JSON.stringify(data);
        }
      } else {
        templateContent = await response.text();
      }
      
      setChangeManagementContent(templateContent);
      setChangeManagementPopupOpen(true);
    } catch (error) {
      console.error('Error generating change management template:', error);
      toast({
        title: "Error",
        description: "There was an error generating the change management template.",
        variant: "destructive"
      });
    } finally {
      setGenerateChangeManagementLoading(false);
    }
  };

  // Function to handle content generation based on type
  const handleGenerateContent = (type: string) => {
    if (type === 'Stakeholder Guides') {
      handleGenerateStakeholderGuides();
    } else if (type === 'Gantt Chart') {
      handleGenerateGanttChart();
    } else if (type === 'Change Management Template') {
      handleGenerateChangeManagement();
    } else {
      toast({
        title: `Generating ${type}`,
        description: "This feature is not yet implemented."
      });
    }
  };

  // Helper function to download content
  const downloadAsPdf = (content: string, filename: string): void => {
    // Create a temporary div to render the markdown content as HTML
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = renderMarkdown(content).__html;
    tempDiv.className = 'prose prose-invert max-w-none p-8 bg-white text-black';
    document.body.appendChild(tempDiv);
    
    // Configure PDF options
    const options = {
      margin: [10, 10, 10, 10],
      filename: filename,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2 },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    
    // Generate PDF
    html2pdf().from(tempDiv).set(options).save().then(() => {
      // Remove the temporary div
      document.body.removeChild(tempDiv);
    });
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

  // Function to render markdown content
  const renderMarkdown = (content: string) => {
    return {
      __html: content.replace(/\n/g, '<br>')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.*?)\*/g, '<em>$1</em>')
        .replace(/# (.*?)(\n|$)/g, '<h1 class="text-2xl font-bold my-4">$1</h1>')
        .replace(/## (.*?)(\n|$)/g, '<h2 class="text-xl font-bold my-3">$1</h2>')
        .replace(/### (.*?)(\n|$)/g, '<h3 class="text-lg font-bold my-2">$1</h3>')
        .replace(/- \[ \] (.*?)(\n|$)/g, '<div class="flex items-start mb-2"><input type="checkbox" class="mt-1 mr-2" /><div>$1</div></div>')
        .replace(/- \[x\] (.*?)(\n|$)/g, '<div class="flex items-start mb-2"><input type="checkbox" checked class="mt-1 mr-2" /><div>$1</div></div>')
        .replace(/- (.*?)(\n|$)/g, '<div class="flex items-start mb-2"><span class="mr-2">•</span><div>$1</div></div>')
        .replace(/```mermaid([\s\S]*?)```/g, '<pre class="bg-gray-900 p-4 my-4 rounded overflow-x-auto">$1</pre>')
        .replace(/```([\s\S]*?)```/g, '<pre class="bg-gray-900 p-4 my-4 rounded overflow-x-auto">$1</pre>')
    };
  };

  // Stakeholder Guide Popup Component
  const StakeholderGuidePopup = () => {
    if (!todoPopupOpen) return null;
    
    const stakeholderList = Object.keys(stakeholderGuides);
    const hasMultipleGuides = stakeholderList.length > 1;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
          {/* Popup Header */}
          <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
            <h3 className="text-xl font-medium">
              {hasMultipleGuides ? 'Stakeholder Guides' : 'Stakeholder Guide'}
            </h3>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-black hover:bg-gray-700 hover:text-gray-200"
              onClick={() => setTodoPopupOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
          
          {/* Stakeholder Selector (only if multiple guides) */}
          {hasMultipleGuides && (
            <div className="px-6 py-3 border-b border-gray-700">
              <div className="flex flex-wrap items-center gap-2">
                <label className="text-sm text-gray-400">Select Stakeholder:</label>
                <div className="flex flex-wrap gap-2 text-black">
                  {stakeholderList.map((name) => (
                    <Button
                      key={name}
                      variant={selectedStakeholder === name ? "default" : "outline"}
                      size="sm"
                      onClick={() => {
                        setSelectedStakeholder(name);
                        setTodoContent(stakeholderGuides[name]);
                      }}
                    >
                      {name}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* Popup Content */}
          <div className="p-6 overflow-y-auto flex-grow">
            {/* Guide content with Markdown rendering */}
            <div 
              className="prose prose-invert max-w-none"
              dangerouslySetInnerHTML={renderMarkdown(todoContent)}
            />
          </div>
          
          {/* Popup Footer */}
          <div className="px-6 py-4 border-t border-gray-700 flex justify-end space-x-2 bg-black text-black">
            <Button 
              variant="outline" 
              onClick={() => setTodoPopupOpen(false)}
            >
              Close
            </Button>
            <Button 
              className="bg-black hover:bg-gray-800 text-white"
              onClick={() => {
                const filename = selectedStakeholder 
                  ? `${project.name.replace(/\s+/g, '-').toLowerCase()}-${selectedStakeholder.replace(/\s+/g, '-').toLowerCase()}-guide.pdf`
                  : `${project.name.replace(/\s+/g, '-').toLowerCase()}-stakeholder-guide.pdf`;
                
                downloadAsPdf(todoContent, filename);
              }}
            >
              Download
            </Button>
          </div>
        </div>
      </div>
    );
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

          
          {/* Empty div to push title to center */}
          <div className="flex-1"></div>
          
          {/* Centered title */}
          <h1 className="text-xl font-bold text-center text-white absolute left-1/2 transform -translate-x-1/2">
            Fluxion
          </h1>
          
          {/* Action buttons */}
          <div className="flex space-x-2">
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-black hover:bg-gray-800"
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
                    className="w-full h-32 flex flex-col items-center justify-center bg-blue-500 hover:bg-blue-600 transition-colors duration-200"
                    onClick={() => handleGenerateContent('Gantt Chart')}
                    disabled={generateGanttChartLoading}
                  >
                    {generateGanttChartLoading ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                        <span className="text-lg font-medium">Generating...</span>
                      </div>
                    ) : (
                      <>
                        <BarChart3 className="h-10 w-10 mb-2" />
                        <span className="text-lg font-medium">Generate Gantt Chart</span>
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-gray-400 mt-2 text-center">
                    Create a timeline visualization for your project
                  </p>
                </div>
                
                {/* Change Management Template Button */}
                <div className="flex flex-col items-center">
                  <Button 
                    className="w-full h-32 flex flex-col items-center justify-center bg-blue-500 hover:bg-blue-600 transition-colors duration-200"
                    onClick={() => handleGenerateContent('Change Management Template')}
                    disabled={generateChangeManagementLoading}
                  >
                    {generateChangeManagementLoading ? (
                      <div className="flex flex-col items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mb-2"></div>
                        <span className="text-lg font-medium">Generating...</span>
                      </div>
                    ) : (
                      <>
                        <FileText className="h-10 w-10 mb-2" />
                        <span className="text-lg font-medium">Change Management Template</span>
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-gray-400 mt-2 text-center">
                    Create a template for managing project changes
                  </p>
                </div>
                
                {/* Stakeholder Guides Button - Updated from Todo List */}
                <div className="flex flex-col items-center">
                  <Button 
                    className="w-full h-32 flex flex-col items-center justify-center bg-blue-500 hover:bg-blue-600 transition-colors duration-200"
                    onClick={() => handleGenerateStakeholderGuides()}
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
                        <span className="text-lg font-medium">Generate Stakeholder Guides</span>
                      </>
                    )}
                  </Button>
                  <p className="text-sm text-gray-400 mt-2 text-center">
                    Create tailored guides for each stakeholder to adapt to change
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

      {/* Stakeholder Guide Popup */}
      <StakeholderGuidePopup />

      {/* Gantt Chart Popup */}
      {ganttChartPopupOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Popup Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
              <h3 className="text-xl font-medium">Gantt Chart</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                onClick={() => setGanttChartPopupOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Popup Content */}
            <div className="p-6 overflow-y-auto flex-grow">
              {
                ganttChartContent.includes('gantt') ? (
                  <GanttChartViewer
                    chart={ganttChartContent
                      .replace(/```mermaid/g, '')
                      .replace(/```/g, '')
                      .trim()}
                  />
                ) : (
                  <div
                    className="prose prose-invert max-w-none"
                    dangerouslySetInnerHTML={renderMarkdown(ganttChartContent)}
                  />
                )
              }
            </div>
            
            {/* Popup Footer */}
            <div className="px-6 py-4 border-t border-gray-700 flex justify-end space-x-2 text-black">
              <Button 
                variant="outline" 
                onClick={() => setGanttChartPopupOpen(false)}
              >
                Close
              </Button>
              <Button 
                className="bg-black hover:bg-gray-800 text-white"
                onClick={() => {
                  downloadAsPdf(
                    ganttChartContent, 
                    `${project.name.replace(/\s+/g, '-').toLowerCase()}-gantt-chart.pdf`
                  );
                }}
              >
                Download
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Change Management Template Popup */}
      {changeManagementPopupOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg shadow-lg w-full max-w-4xl max-h-[90vh] flex flex-col">
            {/* Popup Header */}
            <div className="flex justify-between items-center px-6 py-4 border-b border-gray-700">
              <h3 className="text-xl font-medium">Change Management Template</h3>
              <Button 
                variant="ghost" 
                size="sm" 
                className="text-gray-400 hover:bg-gray-700 hover:text-gray-200"
                onClick={() => setChangeManagementPopupOpen(false)}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Popup Content */}
            <div className="p-6 overflow-y-auto flex-grow">
              {/* Change Management Template content with Markdown rendering */}
              <div 
                className="prose prose-invert max-w-none"
                dangerouslySetInnerHTML={renderMarkdown(changeManagementContent)}
              />
            </div>
            
            {/* Popup Footer */}
            <div className="px-6 py-4 border-t border-gray-700 flex justify-end space-x-2 text-black">
              <Button 
                variant="outline" 
                onClick={() => setChangeManagementPopupOpen(false)}
              >
                Close
              </Button>
              <Button 
                className="bg-black hover:bg-gray-800 text-white"
                onClick={() => {
                  downloadAsPdf(
                    changeManagementContent, 
                    `${project.name.replace(/\s+/g, '-').toLowerCase()}-change-management-template.pdf`
                  );
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