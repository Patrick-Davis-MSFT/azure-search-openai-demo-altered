import { AskRequest, AskResponse, ChatRequest, Indexes, ReadyFiles } from "./models";
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

export async function postFile(inFile: FileContent): Promise<string> {

    const formData = new FormData();
    formData.append(
        "file",
        new Blob([inFile.content]),
        inFile.name
    );

    const response = await fetch("/upload", {
        method: "POST",
        body: formData
    });

    const parsedResponse: string = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error("Uploading File: Unknown error");
    }

    return parsedResponse;
    
}