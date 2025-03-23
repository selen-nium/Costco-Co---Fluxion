"use client";
import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from "sonner";

export default function ProjectChat() {
    const params = useParams();
    // For client components in Next.js 15, we need to handle params differently
    // The params object from useParams() is a ReadonlyURLSearchParams-like object
    // We need to convert it to a string safely
    const [projectId, setProjectId] = useState<string>("");
    
    useEffect(() => {
        // Extract and set the projectId when params are available
        if (params && params.projectId) {
            // Handle both string and string[] types that could come from params
            const id = Array.isArray(params.projectId) 
                ? params.projectId[0] 
                : params.projectId.toString();
            setProjectId(id);
        }
    }, [params]);

    // In your ProjectChat.tsx component, add this
    useEffect(() => {
      // Set up an error handler for unhandled promise rejections
      const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        console.error("Unhandled rejection:", event.reason);
        
        // Show a toast notification for the error
        toast.error("Connection error", {
          description: "There was a problem connecting to the chat service. Please try again."
        });
      };

      window.addEventListener('unhandledrejection', handleUnhandledRejection);
      
      return () => {
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      };
    }, []);

    // Only render the chat window once we have the projectId
    if (!projectId) {
        return <div>Loading...</div>;
    }

    const InfoCard = (
      <GuideInfoBox>
        <ul>
          <li className="text-l">
            🌟
            <span className="ml-2">
              Welcome to <strong>Fluxion</strong> — your friendly AI assistant for change management!
            </span>
          </li>
          <li className="hidden text-l md:block">
            📦
            <span className="ml-2">
              Behind the scenes, Fluxion uses smart memory and a vector retriever to deeply understand your project context and guide you with insight.
            </span>
          </li>
          <li className="text-l">
            💬
            <span className="ml-2">
              Upload your documents and ask anything — try{" "}
              <code className="bg-gray-800 text-white px-1 py-0.5 rounded">What are some ways to manage resistance to change?</code> to get started!
            </span>
          </li>
        </ul>
      </GuideInfoBox>
    );
    
    return (
        <ChatWindow
          endpoint={`/project/${projectId}/api/chat/retrieval_agents`}
          chatHistoryEndpoint={`/project/${projectId}/api/chat/retrieval_agents`}
          emptyStateComponent={InfoCard}
          showIngestForm={true}
          showIntermediateStepsToggle={true}
          placeholder={
            'How can we change today for a better tomorrow?'
          }
          emoji="🤖"
          sessionId="default"
          loadChatHistoryOnMount={true}
        />
    );
}