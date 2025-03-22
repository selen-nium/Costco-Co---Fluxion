import { cn } from "@/utils/cn";
import type { Message } from "ai/react";
import ReactMarkdown from "react-markdown";

export function ChatMessageBubble(props: {
  message: Message;
  aiEmoji?: string;
  sources: any[];
}) {
  // More robust content handling
  const messageContent = (() => {
    const content = props.message.content;
    if (typeof content === 'string') {
      return content;
    } else if (content === null || content === undefined) {
      return "";
    } else if (typeof content === 'object') {
      try {
        return JSON.stringify(content, null, 2);
      } catch (e) {
        return String(content);
      }
    } else {
      return String(content);
    }
  })();

  return (
    <div
      className={cn(
        `rounded-[24px] max-w-[80%] mb-8 flex`,
        props.message.role === "user"
          ? "bg-secondary text-secondary-foreground px-4 py-2"
          : null,
        props.message.role === "user" ? "ml-auto" : "mr-auto",
      )}
    >
      {props.message.role !== "user" && (
        <div className="mr-4 border bg-secondary -mt-2 rounded-full w-10 h-10 flex-shrink-0 flex items-center justify-center">
          {props.aiEmoji}
        </div>
      )}

      <div className="flex flex-col leading-tight">
        <ReactMarkdown 
          components={{
            h1: ({children, ...props}) => <h1 className="text-2xl font-bold mt-3 mb-2" {...props}>{children}</h1>,
            h2: ({children, ...props}) => <h2 className="text-xl font-bold mt-2 mb-1" {...props}>{children}</h2>,
            h3: ({children, ...props}) => <h3 className="text-lg font-bold mt-2 mb-1" {...props}>{children}</h3>,
            p: ({children, ...props}) => <p className="mb-1" {...props}>{children}</p>,
            strong: ({children, ...props}) => <strong className="font-bold" {...props}>{children}</strong>,
            em: ({children, ...props}) => <em className="italic" {...props}>{children}</em>,
            ul: ({children, ...props}) => <ul className="list-disc ml-6 my-1" {...props}>{children}</ul>,
            ol: ({children, ...props}) => <ol className="list-decimal ml-6 my-1" {...props}>{children}</ol>,
            li: ({children, ...props}) => <li className="mb-0.5" {...props}>{children}</li>,
            code: ({children, className, ...props}) => {
              const isInline = !className || !className.includes('language-');
              return isInline ? 
                <code className="bg-gray-100 dark:bg-gray-800 px-1 py-0.5 rounded font-mono text-sm" {...props}>{children}</code> :
                <code className="block bg-gray-100 dark:bg-gray-800 p-2 my-1 rounded font-mono text-sm overflow-x-auto" {...props}>{children}</code>;
            },
            blockquote: ({children, ...props}) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-1 italic" {...props}>{children}</blockquote>,
            a: ({children, ...props}) => <a className="text-blue-600 dark:text-blue-400 hover:underline" {...props}>{children}</a>
          }}
        >
          {messageContent}
        </ReactMarkdown>

        {props.sources && props.sources.length ? (
          <>
            <code className="mt-4 mr-auto bg-primary px-2 py-1 rounded">
              <h2>🔍 Sources:</h2>
            </code>
            <code className="mt-1 mr-2 bg-primary px-2 py-1 rounded text-xs">
              {props.sources?.map((source, i) => (
                <div className="mt-2" key={"source:" + i}>
                  {i + 1}. &quot;{source.pageContent}&quot;
                  {source.metadata?.loc?.lines !== undefined ? (
                    <div>
                      <br />
                      Lines {source.metadata?.loc?.lines?.from} to{" "}
                      {source.metadata?.loc?.lines?.to}
                    </div>
                  ) : (
                    ""
                  )}
                </div>
              ))}
            </code>
          </>
        ) : null}
      </div>
    </div>
  );
}