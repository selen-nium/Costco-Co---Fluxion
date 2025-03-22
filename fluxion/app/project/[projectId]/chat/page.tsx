"use client";
import { ChatWindow } from "@/components/ChatWindow";
import { GuideInfoBox } from "@/components/guide/GuideInfoBox";
import { useParams } from 'next/navigation';

export default function ProjectChat() {
    const params = useParams();
    const projectId = params.projectId;

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
      emptyStateComponent={InfoCard}
      showIngestForm={true}
      showIntermediateStepsToggle={true}
      placeholder={
        'How can we change today for a better tomorrow?'
      }
      emoji="🤖"
    />
  );
}
