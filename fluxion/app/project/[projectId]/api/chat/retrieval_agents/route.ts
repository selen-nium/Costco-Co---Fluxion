// /app/project/[projectId]/api/chat/retrieval_agents/route.ts
import { NextRequest, NextResponse } from "next/server";
import { Message as VercelChatMessage, StreamingTextResponse } from "ai";
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import {
  AIMessage,
  BaseMessage,
  ChatMessage,
  HumanMessage,
  SystemMessage,
} from "@langchain/core/messages";
import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { createRetrieverTool } from "langchain/tools/retriever";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { RunnableWithMessageHistory } from "@langchain/core/runnables";
import { BaseChatMessageHistory } from "@langchain/core/chat_history";

// Add validation function to filter out empty messages
const validateMessages = (messages: BaseMessage[]): BaseMessage[] => {
  // Filter out messages with empty content
  return messages.filter(message => {
    // Check if content is a string and not empty
    if (typeof message.content === 'string') {
      return message.content.trim() !== '';
    }
    // For non-string content, ensure it's not null/undefined
    return message.content !== null && message.content !== undefined;
  });
};

const convertVercelMessageToLangChainMessage = (message: VercelChatMessage) => {
  if (message.role === "user") {
    return new HumanMessage(message.content);
  } else if (message.role === "assistant") {
    return new AIMessage(message.content);
  } else {
    return new ChatMessage(message.content, message.role);
  }
};

const convertLangChainMessageToVercelMessage = (message: BaseMessage) => {
  if (message._getType() === "human") {
    return { content: message.content, role: "user" };
  } else if (message._getType() === "ai") {
    return {
      content: message.content,
      role: "assistant",
      tool_calls: (message as AIMessage).tool_calls,
    };
  } else {
    return { content: message.content, role: message._getType() };
  }
};

// Function to normalize message format before storing in database
function normalizeMessage(message: BaseMessage) {
  const type = message._getType();
  
  // For AIMessage with tool calls
  if (type === "ai") {
    const aiMessage = message as AIMessage;
    let content = aiMessage.content;
    
    // Ensure content is a string
    if (typeof content !== 'string') {
      try {
        content = JSON.stringify(content);
      } catch (e) {
        content = String(content);
      }
    }
    
    return {
      type: "ai",
      content: content,
      tool_calls: aiMessage.tool_calls || []
    };
  }
  // For tool messages
  else if (type === "tool") {
    return {
      type: "tool",
      content: typeof message.content === 'string' 
        ? message.content 
        : JSON.stringify(message.content)
    };
  }
  // For human messages
  else if (type === "human") {
    return {
      type: "human",
      content: typeof message.content === 'string' 
        ? message.content 
        : JSON.stringify(message.content)
    };
  }
  // For system messages
  else if (type === "system") {
    return {
      type: "system",
      content: typeof message.content === 'string' 
        ? message.content 
        : JSON.stringify(message.content)
    };
  }
  // For any other message type
  else {
    return {
      type: message._getType(),
      content: typeof message.content === 'string' 
        ? message.content 
        : JSON.stringify(message.content)
    };
  }
}

// Supabase Message History Store implementation
class SupabaseMessageHistory extends BaseChatMessageHistory {
  private client;
  private projectId: string;
  private sessionId: string;
  private tableName: string;
  private messageCache: BaseMessage[] | null = null;
  
  // Required for LangChain serialization
  lc_namespace = ["langchain", "chat_history", "supabase"];

  constructor(
    client: any,
    projectId: string,
    sessionId: string,
    tableName: string = "conversation_history"
  ) {
    super();
    this.client = client;
    this.projectId = projectId;
    this.sessionId = sessionId;
    this.tableName = tableName;
  }

  async getMessages(): Promise<BaseMessage[]> {
    try {
      // Return cached messages if available
      if (this.messageCache !== null) {
        return this.messageCache;
      }

      const { data, error } = await this.client
        .from(this.tableName)
        .select("messages")
        .eq("project_id", this.projectId)
        .eq("session_id", this.sessionId)
        .single();

      if (error) {
        // If no history exists yet, return empty array
        if (error.code === "PGRST116") {
          this.messageCache = [];
          return [];
        }
        console.error("Error fetching message history:", error);
        return [];
      }

      const messages = data?.messages?.map((msg: any) => {
        if (msg.type === "human") {
          return new HumanMessage(msg.content);
        } else if (msg.type === "ai") {
          const aiMessage = new AIMessage(msg.content);
          if (msg.tool_calls) {
            aiMessage.tool_calls = msg.tool_calls;
          }
          return aiMessage;
        } else if (msg.type === "system") {
          return new SystemMessage(msg.content);
        } else if (msg.type === "tool") {
          return new ChatMessage(msg.content, "tool");
        } else {
          return new ChatMessage(msg.content, msg.type);
        }
      }) || [];
      
      // Cache the messages
      this.messageCache = messages;
      return messages;
    } catch (error) {
      console.error("Unexpected error fetching messages:", error);
      return [];
    }
  }

  async addMessage(message: BaseMessage): Promise<void> {
    try {
      console.log(`Adding message of type: ${message._getType()}`);
      
      // Get existing messages (from cache if available)
      let messages = this.messageCache;
      if (messages === null) {
        messages = await this.getMessages();
      }
      
      // Add the new message
      messages.push(message);
      this.messageCache = messages;
      
      // Serialize for storage using the normalize function
      const serializedMessages = messages.map(msg => normalizeMessage(msg));

      console.log(`Total messages now: ${serializedMessages.length}`);

      // Check if a record already exists for this project+session
      const { data, error: checkError } = await this.client
        .from(this.tableName)
        .select("id")
        .eq("project_id", this.projectId)
        .eq("session_id", this.sessionId)
        .single();
      
      let result;
      
      if (checkError && checkError.code === "PGRST116") {
        // Record doesn't exist, insert a new one
        console.log("Creating new conversation record");
        result = await this.client
          .from(this.tableName)
          .insert({
            project_id: this.projectId,
            session_id: this.sessionId,
            messages: serializedMessages,
          });
      } else {
        // Record exists, update it
        console.log(`Updating existing conversation record (ID: ${data?.id})`);
        result = await this.client
          .from(this.tableName)
          .update({
            messages: serializedMessages,
            updated_at: new Date().toISOString()
          })
          .eq("project_id", this.projectId)
          .eq("session_id", this.sessionId);
      }
      
      if (result.error) {
        console.error("Error saving message history:", result.error);
        // Clear cache on error to force re-fetch
        this.messageCache = null;
      }
    } catch (error) {
      console.error("Unexpected error adding message:", error);
      // Clear cache on error to force re-fetch
      this.messageCache = null;
    }
  }

  // Required methods from BaseChatMessageHistory interface
  async addUserMessage(message: string): Promise<void> {
    await this.addMessage(new HumanMessage(message));
  }

  async addAIMessage(message: string): Promise<void> {
    await this.addMessage(new AIMessage(message));
  }
  
  // This method is required and different from addAIMessage
  async addAIChatMessage(message: string): Promise<void> {
    await this.addMessage(new AIMessage(message));
  }

  async clear(): Promise<void> {
    try {
      const { error } = await this.client
        .from(this.tableName)
        .delete()
        .eq("project_id", this.projectId)
        .eq("session_id", this.sessionId);

      if (error) {
        console.error("Error clearing message history:", error);
      } else {
        // Clear the message cache
        this.messageCache = null;
        console.log("Chat history cleared successfully");
      }
    } catch (error) {
      console.error("Unexpected error clearing history:", error);
      // Clear cache on error to force re-fetch
      this.messageCache = null;
    }
  }
}

// Endpoint to get chat history
export async function GET(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    // Properly unwrap the Promise to access params
    const params = await context.params;
    const projectId = params.projectId;
    
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get("sessionId") || "default";

    // Initialize Supabase client
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Supabase credentials not configured" },
        { status: 500 }
      );
    }
    
    const client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PRIVATE_KEY
    );
    
    // Get conversation history from Supabase
    const { data, error } = await client
      .from("conversation_history")
      .select("messages")
      .eq("project_id", projectId)
      .eq("session_id", sessionId)
      .single();
      
    if (error && error.code !== "PGRST116") {
      console.error("Error fetching message history:", error);
      return NextResponse.json(
        { error: "Failed to fetch chat history" },
        { status: 500 }
      );
    }
    
    // If no history exists yet, return empty array
    if (!data) {
      return NextResponse.json({ messages: [] }, { status: 200 });
    }
    
    // Convert stored messages to Vercel format
    const messages = data.messages.map((msg: any) => {
      if (msg.type === "human") {
        return { content: msg.content, role: "user" };
      } else if (msg.type === "ai") {
        return {
          content: msg.content,
          role: "assistant",
          tool_calls: msg.tool_calls,
        };
      } else {
        return { content: msg.content, role: msg.type };
      }
    });
    
    return NextResponse.json({ messages }, { status: 200 });
  } catch (e: any) {
    console.error("Error in GET chat history:", e);
    return NextResponse.json(
      { error: e.message },
      { status: e.status ?? 500 }
    );
  }
}

const AGENT_SYSTEM_TEMPLATE = `You are a change management professional specialized in change management. 
You have access to a tool called "search_latest_knowledge" that searches documents uploaded by the user.
You MUST call this tool to retrieve relevant information before answering ANY user question.
Remember previous conversations with the user and refer to them when appropriate.`;

export async function POST(
  req: NextRequest,
  context: { params: Promise<{ projectId: string }> }
) {
  try {
    console.log("Chat - Headers:", Object.fromEntries(req.headers.entries()));
    
    // Properly unwrap the Promise to access params
    const params = await context.params;
    const projectId = params.projectId;
    
    const body = await req.json();
    const messages = (body.messages ?? [])
    .filter(
      (message: VercelChatMessage) =>
        message.role === "user" || message.role === "assistant",
    )
    .map(convertVercelMessageToLangChainMessage);
    const returnIntermediateSteps = body.show_intermediate_steps;
    const sessionId = body.sessionId || "default";

    // Filter out any messages with empty content
    const validatedMessages = validateMessages(messages);

    // Initialize the chat model
    const chatModel = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      temperature: 0.7,
      maxOutputTokens: 4096,
    });

    // Initialize Supabase client and vector store
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PRIVATE_KEY) {
      return NextResponse.json(
        { error: "Supabase credentials not configured" },
        { status: 500 }
      );
    }
    
    const client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_PRIVATE_KEY
    );
    
    const embeddings = new HuggingFaceInferenceEmbeddings({
      model: "sentence-transformers/all-MiniLM-L6-v2",
      apiKey: process.env.HUGGINGFACEHUB_API_KEY,
    });
    
    const vectorstore = new SupabaseVectorStore(embeddings, {
      client,
      tableName: "documents",
      queryName: "match_documents",
    });

    // Create retriever and tool
    const retriever = vectorstore.asRetriever();
    const tool = createRetrieverTool(retriever, {
      name: "search_latest_knowledge",
      description: "Searches and returns up-to-date general information.",
    });

    // Create the agent
    const agent = await createReactAgent({
      llm: chatModel,
      tools: [tool],
      messageModifier: new SystemMessage(AGENT_SYSTEM_TEMPLATE),
    });
    
    // Set up message history
    const messageHistory = new SupabaseMessageHistory(
      client,
      projectId,
      sessionId
    );
    
    // Wrap agent with message history
    const agentWithHistory = new RunnableWithMessageHistory({
      runnable: agent,
      getMessageHistory: () => messageHistory,
      inputMessagesKey: "messages",
      historyMessagesKey: "history",
    });

    if (!returnIntermediateSteps) {
      // Get the last user message (to save later)
      const lastUserMessage = validatedMessages.length > 0 ? validatedMessages[validatedMessages.length - 1] : null;
      
      try {
        // Save the user message first if it exists
        if (lastUserMessage && lastUserMessage._getType() === "human") {
          await messageHistory.addMessage(lastUserMessage);
        }
        
        // Set a flag to indicate we need to save the AI response
        // This is to prevent duplicate saves since LangGraph might also be 
        // saving to message history via the agentWithHistory wrapper
        let shouldSaveAIResponse = false; // Default to NOT saving manually
        
        // Stream the response
        const eventStream = await agentWithHistory.streamEvents(
          { messages: validatedMessages, history: [] },
          { 
            version: "v2",
            configurable: { sessionId } // Add sessionId to the configurable options
          },
        );
  
        const textEncoder = new TextEncoder();
       // In your chat/retrieval_agents route
       const transformStream = new ReadableStream({
        async start(controller) {
          let responseContent = "";
          
          try {
            // In your route.ts POST handler, update how you process events
            for await (const event of eventStream) {
              try {
                // Handle different event types from LangGraph
                if (event.event === "on_chat_model_stream") {
                  if (event.data?.chunk?.content) {
                    controller.enqueue(textEncoder.encode(event.data.chunk.content));
                    responseContent += event.data.chunk.content;
                  }
                } 
                // Add specific handling for tool calls
                else if (event.event === "on_tool_start" || 
                        event.event === "on_tool_end" || 
                        event.event === "on_chain_start" || 
                        event.event === "on_chain_end") {
                  // Log but don't send to client
                  console.log(`LangGraph event: ${event.event}`);
                }
              } catch (error) {
                console.error("Error processing event:", error, "Event:", event);
              }
            }
            
            // Only save AI response if needed and if we have content
            if (responseContent) {
              await messageHistory.addMessage(new AIMessage(responseContent));
            }
          } catch (error) {
            console.error("Stream processing error:", error);
            // Provide a fallback response on error
            const errorMessage = "I encountered an error processing your request. Please try again.";
            controller.enqueue(textEncoder.encode(errorMessage));
          } finally {
            controller.close();
          }
        },
      });
  
        return new StreamingTextResponse(transformStream);
      } catch (error) {
        console.error("Error in streaming response:", error);
        return NextResponse.json(
          { error: "Error processing your request" },
          { status: 500 }
        );
      }
    } else {
      try {
        // Save the last user message first
        if (validatedMessages.length > 0) {
          const lastUserMessage = validatedMessages[validatedMessages.length - 1];
          if (lastUserMessage._getType() === "human") {
            await messageHistory.addMessage(lastUserMessage);
          }
        }
        
        // Set a flag to indicate if we need to save the AI response
        // This is to prevent duplicate saves since LangGraph might also be 
        // saving to message history via the agentWithHistory wrapper
        let shouldSaveAIResponse = false; // Default to NOT saving manually
        
        // Return the full result with intermediate steps
        const result = await agentWithHistory.invoke(
          { 
            messages: validatedMessages,
            history: [],
          },
          {
            configurable: { sessionId } // Add sessionId to the configurable options
          }
        );
        
        // Only save the AI response if we determined we need to manually save
        if (shouldSaveAIResponse && result.messages.length > 0) {
          const lastMessage = result.messages[result.messages.length - 1];
          if (lastMessage._getType() === "ai") {
            console.log("Manually saving AI response to message history");
            await messageHistory.addMessage(lastMessage);
          }
        }
        
        return NextResponse.json(
          {
            messages: result.messages.map(convertLangChainMessageToVercelMessage),
          },
          { status: 200 },
        );
      } catch (error) {
        console.error("Error in processing with intermediate steps:", error);
        return NextResponse.json(
          { error: "Error processing your request with intermediate steps" },
          { status: 500 }
        );
      }
    }
  } catch (e: any) {
    console.error("Error in chat processing:", e);
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}