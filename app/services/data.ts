import { PrismaClient } from "@prisma/client";
import OpenAI from "openai";
import { Answer, GenerationWithPrompts } from "./service";
import { zodResponseFormat } from "openai/helpers/zod";
import { z } from 'zod';

const Response = z.object({
    prompts: z.array(z.string())
});

const prismaClient = new PrismaClient();

const openAiClient = new OpenAI({
    apiKey: process.env['OPENAI_API_KEY']
});

export async function readSession(id: number) {

    const steps = await prismaClient.userSession.findFirst({ 
        where: { 
            id: id 
        }, 
        include: { 
            generations: { 
                include: { 
                    promptResults: true 
                } 
            }
        }
    });

    return steps;
}

export async function CreateSession(systemPrompt: string, userQuery: string, answer: string) {
    return await prismaClient.userSession.create({
        data: {
            systemPrompt: systemPrompt,
            userPrompt: userQuery,
            answer: answer
        }
    });
}

export async function createFirstGeneration(sessionId: number, answers: Answer[]) {

    // 世代削除（再生成用）
    await prismaClient.generation.deleteMany({ 
        where: { 
            userSessionId: sessionId,
        }
    });

    // 生成
    await prismaClient.generation.create({
        data: {
            userSessionId: sessionId,
            promptResults: {
                create: answers.map((answer, i) => ({
                    prompt: answer.prompt,
                    answer: answer.answer,
                    promptOrder: i
                }))
            }
        }
    });
}

export async function createNextGeneration(sessionId: number, generation: GenerationWithPrompts, answers: Answer[]) {

    // この世代以降を削除（再生成用）
    await prismaClient.generation.deleteMany({ 
        where: { 
            userSessionId: sessionId,
            id: {
                gte: generation.id
            }
        }
    });

    // 生成
    await prismaClient.generation.create({
        data: {
            userSessionId: sessionId,
            additionalPrompt: generation.additionalPrompt,
            promptResults: {
                create: generation.promptResults.map((result, i) => ({
                    prompt: result.prompt,
                    answer: result.answer,
                    promptOrder: i
                }))
            }
        }
    });

    // 回答を生成して保存
    await prismaClient.generation.create({
        data: {
            userSessionId: sessionId,
            promptResults: {
                create: answers.map((answer, i) => ({
                    prompt: answer.prompt,
                    answer: answer.answer,
                    promptOrder: i
                }))
            }
        }
    });
}

export async function getFirstPrompts(systemPrompt: string) {
    
    const firstSystemPrompt = `ユーザの入力に対して適切な回答を返すプロンプトを遺伝的アルゴリズムを使ってチューニングします。
1つ目のプロンプトを「システムプロンプト」、2つ目のプロンプトを「チューニングプロンプト」と呼びます。
オリジナルの「チューニングプロンプト」を改良する形で新たな5つのプロンプトを作成してください。
------
・オリジナルの「チューニングプロンプト」の意図を理解し、より良い回答を返すために改良してください
・オリジナルの「チューニングプロンプト」の重要な情報が失われないように十分に注意してください
・これらの5つのプロンプトはそれぞれ独立して評価されます`;
    
    const completion = await openAiClient.beta.chat.completions.parse({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [
            { role: 'system', content: firstSystemPrompt },
            { role: 'system', content: systemPrompt },
        ],
        response_format: zodResponseFormat(Response, 'response'),
    });

    const message = completion.choices[0]?.message;
    if (!message?.parsed) {
        return {
            token: completion.usage?.total_tokens || 0,
            prompts: []
        };
    } else {
        return {
            token: completion.usage?.total_tokens || 0,
            prompts: message.parsed.prompts
        }
    }
}

export async function getNextPrompts(systemPrompt: string, generation: GenerationWithPrompts) {

    const firstSystemPrompt = `ユーザの入力に対して適切な回答を返すプロンプトをチューニングします。
    1つ目のプロンプトを「システムプロンプト」、2つ目のプロンプトを「初期プロンプト」、3つ目のプロンプトを「チューニングプロンプト」と呼びます。
    ------
    「チューニングプロンプト」には前回のプロンプトがユーザの評価順に与えられるので、新しい5つのプロンプトを遺伝的アルゴリズムを使って改良してください。
    文脈の破壊が起こらないよう、適切な一点交差、一様交差、突然変異を使ってください。
    文章の長さを維持する必要はないので、より良い結果を得るために適宜削除や追加を行ってください。
    ------
    ・「初期プロンプト」の意図を理解し、より良い回答を返すために改良してください
    ・「初期プロンプト」の重要な情報が失われないように十分に注意してください
    ・これらの5つのプロンプトはそれぞれ独立して評価されます`;
        
    const completion = await openAiClient.beta.chat.completions.parse({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [
            { role: 'system', content: firstSystemPrompt },
            { role: 'system', content: systemPrompt },
            { role: 'system', content: generation.promptResults.map(p => p.prompt + "\n" + generation.additionalPrompt).join("\n------\n") },
        ],
        response_format: zodResponseFormat(Response, 'response'),
    });

    const message = completion.choices[0]?.message;
    if (!message?.parsed) {
        return {
            token: completion.usage?.total_tokens || 0,
            prompts: []
        };
    } else {
        return {
            token: completion.usage?.total_tokens || 0,
            prompts: message.parsed.prompts
        }
    }
}

export async function getAnswers(systemPrompts: string[], userPrompt: string) {
   
    const tasks = [];
    for (const systemPrompt of systemPrompts) {
        const task = openAiClient.chat.completions.create({
            model: 'gpt-4o-mini-2024-07-18',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'system', content: userPrompt },
            ],
        });
        tasks.push(task);
    }

    const results = await Promise.all(tasks);
    const answers = results.map((result, i) => ({
        prompt: systemPrompts[i],
        answer: result.choices[0]!.message.content!
    } as Answer));

    return {
        token: results.reduce((acc, result) => acc + (result.usage?.total_tokens || 0), 0),
        answers: answers
    }
}