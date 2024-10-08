import { Generation, PromptResult, UserSession } from "@prisma/client";
import { createFirstGeneration, createNextGeneration, CreateSession, getAnswers, getFirstPrompts, getNextPrompts, readHistories, readSession } from "./data";

export type UserSessionWithGenerations = UserSession & { generations: GenerationWithPrompts[] };
export type GenerationWithPrompts = Generation & { promptResults: PromptResult[] };
export type Answer = { prompt: string, answer: string };

export async function createSession(systemPrompt: string, userQuery: string) {

    // 回答取得
    const { answers, token } = await getAnswers([systemPrompt], userQuery);

    // セッション作成
    const session = await CreateSession(systemPrompt, userQuery, answers[0].answer);

    return {
        id: session.id,
        token: token
    };
}

export async function makeFirstGeneration(id: string) {

    // セッション取得
    const session = await readSession(Number(id));
    if (session === null) {
        return {
            token: 0
        }
    }

    // 初回プロンプト取得
    const { prompts, token: token1 } = await getFirstPrompts(session.systemPrompt);
    if (prompts.length === 0) {
        return {
            token: token1
        };
    }

    // 回答取得
    const { answers, token: token2 } = await getAnswers(prompts, session.userPrompt);

    // 世代作成
    await createFirstGeneration(Number(id), answers);
    
    return {
        token: token1 + token2
    };
}


export async function makeNextGeneration(id: string, generation: GenerationWithPrompts) {

    // セッション取得
    const session = await readSession(Number(id));
    if (session === null) {
        return {
            token: 0,
            generationCount: 0
        }
    }
    
    // 初回プロンプト取得
    const { prompts, token: token1 } = await getNextPrompts(session.systemPrompt, generation);
    if (prompts.length === 0) {
        return {
            token: token1,
            generationCount: session.generations.length
        };
    }

    // 回答取得
    const { answers, token: token2 } = await getAnswers(prompts, session.userPrompt);

    // 世代作成
    await createNextGeneration(Number(id), generation, answers);

    const updatedSession = await readSession(Number(id));

    return {
        token: token1 + token2,
        generationCount: updatedSession!.generations.length
    };
}

export async function loadHistories() {
    return await readHistories();
}

export async function loadSession(id: number) {
    return await readSession(id);
}
