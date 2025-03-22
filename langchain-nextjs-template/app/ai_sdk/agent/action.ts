"use server";

import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { TavilySearchResults } from "@langchain/community/tools/tavily_search";
import { AgentExecutor, createToolCallingAgent } from "langchain/agents";
import { pull } from "langchain/hub";
import { createStreamableValue } from "ai/rsc";

export async function runAgent(input: string) {
  "use server";

  const stream = createStreamableValue();
  (async () => {
    const tools = [new TavilySearchResults({ maxResults: 1 })];
    const prompt = await pull<ChatPromptTemplate>(
      "hwchase17/openai-tools-agent",
    );

    const llm = new ChatGoogleGenerativeAI({
      model: "gemini-gemini-2.0-flash",
      temperature: 0,
      maxOutputTokens: 2048,
      // Optional: safety settings or generation config
    });
  
    const agent = createToolCallingAgent({
      llm,
      tools,
      prompt,
    });

    const agentExecutor = new AgentExecutor({ agent, tools });

    const streamingEvents = agentExecutor.streamEvents(
      { input },
      { version: "v2" },
    );

    for await (const item of streamingEvents) {
      stream.update(JSON.parse(JSON.stringify(item, null, 2)));
    }

    stream.done();
  })();

  return { streamData: stream.value };
}
