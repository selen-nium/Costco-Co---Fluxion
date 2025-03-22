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

const AGENT_SYSTEM_TEMPLATE = `You are a change management professional specialized in change management. 
You have access to a tool called "search_latest_knowledge" that searches documents uploaded by the user.
You MUST call this tool to retrieve relevant information before answering ANY user question.`;

export async function POST(req: NextRequest) {
  try {
    console.log("Chat - Headers:", Object.fromEntries(req.headers.entries()));
    
    const body = await req.json();
    const messages = (body.messages ?? [])
    .filter(
      (message: VercelChatMessage) =>
        message.role === "user" || message.role === "assistant",
    )
    .map(convertVercelMessageToLangChainMessage);
    const returnIntermediateSteps = body.show_intermediate_steps;

    // Initialize the chat model
    const chatModel = new ChatGoogleGenerativeAI({
      model: "gemini-2.0-flash",
      temperature: 0,
      maxOutputTokens: 2048,
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
    
    const vectorstore = new SupabaseVectorStore(
      new HuggingFaceInferenceEmbeddings({
        model: "sentence-transformers/all-MiniLM-L6-v2",
        apiKey: process.env.HUGGINGFACEHUB_API_KEY,
      }),
      {
        client,
        tableName: "documents",
        queryName: "match_documents",
      }
    );

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

    if (!returnIntermediateSteps) {
      // Stream the response
      const eventStream = await agent.streamEvents(
        { messages },
        { version: "v2" },
      );

      const textEncoder = new TextEncoder();
      const transformStream = new ReadableStream({
        async start(controller) {
          for await (const { event, data } of eventStream) {
            if (event === "on_chat_model_stream") {
              if (!!data.chunk.content) {
                controller.enqueue(textEncoder.encode(data.chunk.content));
              }
            }
          }
          controller.close();
        },
      });

      return new StreamingTextResponse(transformStream);
    } else {
      // Return the full result with intermediate steps
      const result = await agent.invoke({ messages });
      return NextResponse.json(
        {
          messages: result.messages.map(convertLangChainMessageToVercelMessage),
        },
        { status: 200 },
      );
    }
  } catch (e: any) {
    console.error("Error in chat processing:", e);
    return NextResponse.json({ error: e.message }, { status: e.status ?? 500 });
  }
}

