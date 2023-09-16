import { AskRequest, AskResponse, ChatRequest, Indexes, OptResponses, ReadyFiles } from "./models";
import { FileContent } from "use-file-picker";

export async function askApi(options: AskRequest): Promise<AskResponse> {
    const response = await fetch("/ask", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            question: options.question,
            approach: options.approach,
            index: options.index,
            overrides: {
                retrieval_mode: options.overrides?.retrievalMode,
                semantic_ranker: options.overrides?.semanticRanker,
                semantic_captions: options.overrides?.semanticCaptions,
                top: options.overrides?.top,
                temperature: options.overrides?.temperature,
                prompt_template: options.overrides?.promptTemplate,
                prompt_template_prefix: options.overrides?.promptTemplatePrefix,
                prompt_template_suffix: options.overrides?.promptTemplateSuffix,
                exclude_category: options.overrides?.excludeCategory
            }
        })
    });

    const parsedResponse: AskResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse;
}

export async function chatApi(options: ChatRequest): Promise<AskResponse> {
    const response = await fetch("/chat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            history: options.history,
            approach: options.approach,
            index: options.index,
            overrides: {
                retrieval_mode: options.overrides?.retrievalMode,
                semantic_ranker: options.overrides?.semanticRanker,
                semantic_captions: options.overrides?.semanticCaptions,
                top: options.overrides?.top,
                temperature: options.overrides?.temperature,
                prompt_template: options.overrides?.promptTemplate,
                prompt_template_prefix: options.overrides?.promptTemplatePrefix,
                prompt_template_suffix: options.overrides?.promptTemplateSuffix,
                exclude_category: options.overrides?.excludeCategory,
                suggest_followup_questions: options.overrides?.suggestFollowupQuestions
            }
        })
    });

    const parsedResponse: AskResponse = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }

    return parsedResponse;
}

export function getCitationFilePath(citation: string): string {
    return `/content/${citation}`;
}

export async function getIndexesAPI(): Promise<OptResponses> {
    const response = await fetch("/getIndex", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    const parsedResponse: OptResponses = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error("Getting Indexes: Unknown error");
    }

    return parsedResponse;
}


export async function getReadyFiles(): Promise<ReadyFiles> {
    const response = await fetch("/readyFiles", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    const parsedResponse: ReadyFiles = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error("Getting Indexes: Unknown error");
    }

    return parsedResponse;
}



export async function streamToBlob(readableStream: ReadableStream): Promise<Blob> {
    const reader = readableStream.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }
    return new Blob(chunks, { type: "application/octet-stream" });
  }
  
export  async function uploadBlob(blob: Blob, fName: string): Promise<void> {
    const formData = new FormData();
    formData.append("file", blob, fName);
    await fetch("/upload", {
      method: "POST",
      body: formData,
    });
  }

export async function removeStagedFile(fileName: string): Promise<void> {
    const response = await fetch("/removeStagedFile", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({"fileName": fileName})
    });
    return response.json();
}

export async function postFile(inFile: FileContent): Promise<string> {

    const formData = new FormData();

    const fStream : ReadableStream = inFile.stream();
const reader = fStream.getReader();
const chunks: any = [];
while(true) {
    const {done, value} = await reader.read();
    if (done) break;
    chunks.push(value);
}
const fBlob = new Blob(chunks, {type: inFile.type});

    formData.append(
        "file",
        fBlob,
        inFile.name,
        
    );
    console.log (inFile.content);
    const response = await fetch("/upload", {
        method: "POST",
        body: formData,
    headers: {
        "Content-Type": "multipart/form-data",
      }});

    const parsedResponse: string = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error("Uploading File: Unknown error");
    }

    return parsedResponse;
    
}

export async function postFile2(fileName:any, fileContent: any): Promise<string> {

    const formData = new FormData();

    /*formData.append(
        "file",
        inFile
    );*/
    console.log (fileName);
    formData.append("filecontent", fileName)
    formData.append("filename", fileContent)
    const response = await fetch("/upload", {
        method: "POST",
        body: formData,
    headers: {
        "Content-Type": "multipart/form-data"
    }
    });

    const parsedResponse: string = await response.text();
    if (response.status > 299 || !response.ok) {
        throw Error("Uploading File: Unknown error");
    }

    return parsedResponse;
    
}

export async function indexReadyFiles(targetIndex: string): Promise<String> {
    const response = await fetch("/indexUploadedFiles", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            index: targetIndex,
        })
    });

    const parsedResponse = await response;
    if (response.status > 299 || !response.ok) {
        throw Error("Indexing files: Unknown error");
    }

    return parsedResponse.text();
}

export async function indexReadyFilesStream(targetIndex: string, setReturn: (result: string) => void): Promise<void> {
    const response = await fetch("/indexUploadedFilesStream", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            index: targetIndex,
        })
    });


    if (response.status > 299 || !response.ok || response.body == null) {
        throw Error("Indexing files: Unknown error: " + response.statusText);
    }
    const reader = response.body.getReader();
    var result: string = "";
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        var newValue = new TextDecoder().decode(value);
        result += newValue + "\n";
        setReturn(result);
    }
}