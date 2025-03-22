// api/retrieval/ingest.ts - Modified to match your existing API structure
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SupabaseVectorStore } from "@langchain/community/vectorstores/supabase";
import { HuggingFaceInferenceEmbeddings } from "@langchain/community/embeddings/hf";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";

export async function POST(req: NextRequest) {
  try {
    console.log("PDF Ingest - Headers:", Object.fromEntries(req.headers.entries()));
    
    const formData = await req.formData();
    
    // Get file from form data
    const file = formData.get("file") as File | null;
    
    if (!file || !(file instanceof File)) {
      console.error("No file or invalid file received");
      return NextResponse.json(
        { error: "Please upload a valid PDF file." },
        { status: 400 }
      );
    }
    
    console.log("File received:", file.name, file.type, file.size);
    
    if (file.type !== "application/pdf") {
      return NextResponse.json(
        { error: "Please upload a valid PDF file." },
        { status: 400 }
      );
    }

    // Convert the file to a blob for PDFLoader
    const arrayBuffer = await file.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: "application/pdf" });
    
    // Use the Blob with PDFLoader
    const loader = new PDFLoader(blob);
    const docs = await loader.load();
    console.log("PDF loaded successfully, pages:", docs.length);

    // Split into chunks
    const splitter = new RecursiveCharacterTextSplitter({
      chunkSize: 256,
      chunkOverlap: 20,
    });
    const splitDocuments = await splitter.splitDocuments(docs);
    console.log("Document split into chunks:", splitDocuments.length);

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
    
    // Store in Supabase
    await SupabaseVectorStore.fromDocuments(
      splitDocuments,
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
    
    console.log("Successfully embedded and stored document");
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    console.error("Error processing PDF:", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
