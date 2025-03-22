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
import { SerpAPI } from "@langchain/community/tools/serpapi";

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

const AGENT_SYSTEM_TEMPLATE = `You are an experienced change management consultant with deep expertise in organizational transformation, stakeholder engagement, and adoption strategies. Your background includes working with diverse industries to implement complex change initiatives.

When interacting with users:

1. First try using the search_uploaded_documents tool to find information from documents the user has uploaded. This ensures your responses incorporate their specific organizational context, methodologies, and terminology.

2. Only if relevant information cannot be found in the uploaded documents, use the search_web tool to find information online. When using web search, clearly indicate that this information is from external sources.

3. If the web search fails or returns unreliable results, gracefully fall back to using only the information from uploaded documents. You can inform the user that you couldn't find reliable web information but are providing insights based on their uploaded materials.

4. Prioritize information from uploaded documents over web search results when both are available.

4. Maintain context awareness by referencing previous conversations where relevant. Draw connections between current questions and past discussions to provide continuity and demonstrate understanding of the user's ongoing change journey.

5. Structure your responses to include:
   - Insights from relevant uploaded materials (primary source)
   - Web search information (only when necessary as secondary source)
   - Practical recommendations tailored to their situation
   - Questions that encourage deeper exploration where appropriate

6. Balance theoretical frameworks with actionable guidance. Whenever you explain change management concepts, include specific implementation steps.

7. At natural points in the conversation, check in with the user about the quality and relevance of your assistance. Ask open-ended questions about how well your recommendations address their specific needs or what additional information would be helpful.

8. Adapt your approach based on user feedback, becoming increasingly tailored to their specific change management challenges and communication preferences over time.`;

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
      temperature: 0,
      maxOutputTokens: 2048,
      apiKey: process.env.GOOGLE_API_KEY || "", // Ensure API key is provided
    });

    // Initialize Supabase client and vector store
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_PRIVATE_KEY || !process.env.GOOGLE_API_KEY) {
      return NextResponse.json(
        { error: "Required credentials not configured (Supabase or Google API)" },
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

    // Create document retriever tool
    const retriever = vectorstore.asRetriever({
      k: 5, // Retrieve 5 most relevant documents
    });
    
    const documentTool = createRetrieverTool(retriever, {
      name: "search_uploaded_documents",
      description: "Searches through the user's uploaded documents for relevant information. Always try this first.",
    });

    // Create SerpAPI tool for web fallback with proper error handling
    class EnhancedSerpAPI extends SerpAPI {
      async _call(input: string): Promise<string> {
        try {
          // Use a more specific query structure to improve results
          const enhancedInput = `${input}`;
          
          // Call the original SerpAPI implementation
          const result = await super._call(enhancedInput);
          
          console.log("SerpAPI raw result for query '" + input + "' (first 200 chars):", 
                     result.substring(0, 200) + (result.length > 200 ? "..." : ""));
          
          // Check if the result is JSON format (starts with { or [)
          if ((result.trim().startsWith('{') || result.trim().startsWith('[')) && 
              (result.includes('"organic_results"') || result.includes('"related_questions"'))) {
            try {
              const parsed = JSON.parse(result);
              
              // Initialize an array to store formatted results
              let extractedInfo: string[] = [];
              extractedInfo.push(`Based on web search results about "${input}":\n`);
              
              // Extract organic results
              if (parsed.organic_results && parsed.organic_results.length > 0) {
                extractedInfo.push("## Top Search Results");
                parsed.organic_results.slice(0, 5).forEach((item: any, index: number) => {
                  if (item.title) {
                    extractedInfo.push(`${index + 1}. ${item.title}`);
                    if (item.snippet) {
                      extractedInfo.push(`   ${item.snippet}`);
                    }
                    if (item.source) {
                      extractedInfo.push(`   Source: ${item.source}`);
                    }
                    extractedInfo.push("");
                  }
                });
              }
              
              // Extract related questions/answers
              if (parsed.related_questions && parsed.related_questions.length > 0) {
                extractedInfo.push("## Frequently Asked Questions");
                parsed.related_questions.forEach((item: any, index: number) => {
                  if (item.question) {
                    extractedInfo.push(`Q: ${item.question}`);
                    
                    if (item.snippet) {
                      extractedInfo.push(`A: ${item.snippet}`);
                    } else if (item.list && item.list.length > 0) {
                      extractedInfo.push("A:");
                      item.list.forEach((listItem: string) => {
                        extractedInfo.push(`- ${listItem.trim()}`);
                      });
                    }
                    extractedInfo.push("");
                  }
                });
              }
              
              // Extract answer box content if available
              if (parsed.answer_box && parsed.answer_box.expanded_list) {
                extractedInfo.push("## Key Trends");
                parsed.answer_box.expanded_list.forEach((item: any, index: number) => {
                  if (item.title) {
                    extractedInfo.push(`- ${item.title}`);
                  }
                });
                extractedInfo.push("");
              }
              
              // If we've extracted meaningful information, return it
              if (extractedInfo.length > 3) { // More than just the header and empty sections
                return extractedInfo.join("\n");
              }
            } catch (e) {
              console.log("Failed to parse SerpAPI JSON result:", e);
              // Continue to fallback extraction methods
            }
          }
          
          // If JSON parsing didn't work, try to extract content as best we can from text
          // Check if the result contains useful information
          if (result.includes("Related Questions") || result.includes("organic_results") || 
              result.includes("snippet") || result.length > 300) {
            
            // Remove any problematic patterns or formatting
            const cleanedResult = result
              .replace(/entity_type: related_questions/g, "")
              .replace(/serpapi_link|next_page_token|google_url|raw_html_file/g, "")
              .replace(/\\n/g, "\n")
              .replace(/\\/g, "");
            
            // Return with a nice header
            return `Web search results for "${input}":\n\n${cleanedResult}`;
          }
          
          // If we get here, the result might not be very useful
          return `I found limited information about "${input}" from web search. I'll rely primarily on information from your uploaded documents.`;
          
        } catch (error: unknown) {
          console.error("SerpAPI search error:", error);
          // Return a user-friendly message instead of throwing
          return `Web search is currently unavailable for "${input}". I'll rely on information from your uploaded documents.`;
        }
      }
    }
    
    const serpApiTool = new EnhancedSerpAPI(process.env.SERPAPI_API_KEY, {
      location: "United States",
      hl: "en",
      gl: "us",
    });

    // Rename the SerpAPI tool to be clearer about its purpose
    serpApiTool.name = "search_web";
    serpApiTool.description = "Search the web for information not found in the uploaded documents. Use this only when the document search doesn't provide sufficient information. If search fails, focus on information from uploaded documents.";

    // Create the agent with both tools
    const agent = await createReactAgent({
      llm: chatModel,
      tools: [documentTool, serpApiTool],
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
            configurable: { sessionId }, // Add sessionId to the configurable options
            callbacks: [{
              handleToolError: async (err: unknown) => {
                // Errors should be less common now as EnhancedSerpAPI handles most cases
                // This is a fallback for any unhandled errors
                console.error("Unhandled tool error:", err);
                
                const errorMessage = err instanceof Error ? err.message : String(err);
                
                if (errorMessage.includes("SerpAPI") || 
                    errorMessage.includes("search") ||
                    errorMessage.includes("web")) {
                  return "I couldn't complete the web search. Let me focus on information from your uploaded documents instead.";
                }
                
                // For other tool errors, return a generic message
                return "I encountered an issue with one of my tools. Let me try to answer based on what I know.";
              }
            }]
          },
        );
  
        const textEncoder = new TextEncoder();
        const transformStream = new ReadableStream({
          async start(controller) {
            let responseContent = "";
            
            for await (const { event, data } of eventStream) {
              if (event === "on_chat_model_stream") {
                if (!!data.chunk.content) {
                  controller.enqueue(textEncoder.encode(data.chunk.content));
                  responseContent += data.chunk.content;
                }
              }
            }
            
            // Only save the AI response if we determined we need to do manual saving
            if (responseContent && shouldSaveAIResponse) {
              console.log("Manually saving AI response to message history");
              await messageHistory.addMessage(new AIMessage(responseContent));
            }
            
            controller.close();
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
            configurable: { sessionId }, // Add sessionId to the configurable options
            callbacks: [{
              handleToolError: async (err) => {
                if (err.message.includes("SerpAPI")) {
                  // Convert SerpAPI errors to a friendly message
                  return "I couldn't access external search results at the moment. I'll work with the information available in your uploaded documents.";
                }
                // Pass through other errors
                throw err;
              }
            }]
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