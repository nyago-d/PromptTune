import { Generation, PrismaClient, PromptResult } from "@prisma/client";
import OpenAI from "openai";
import { zodResponseFormat } from "openai/helpers/zod";
import { ChatCompletionMessage } from "openai/resources/index.mjs";
import { z } from 'zod';

export type GenerationWithPrompts = Generation & { promptResults: PromptResult[] };

const Response = z.object({
    prompts: z.array(z.string())
});

export async function createSession(systemPrompt: string, userQuery: string) {

    const client = new OpenAI({
        apiKey: process.env['OPENAI_API_KEY']
    });
    const answers = await getAnswer([systemPrompt], userQuery, client);

    const prisma = new PrismaClient();
    const session = await prisma.userSession.create({
        data: {
            systemPrompt: systemPrompt,
            userPrompt: userQuery,
            answer: answers[0].answer
        }
    });
    prisma.$disconnect();

    return {
        id: session.id,
        token: answers[0].token
    };
}

export async function createFirstGeneration(id: string) {

    const prisma = new PrismaClient();
    const session = (await prisma.userSession.findFirst({ where: { id: Number(id) } }))!;

    const client = new OpenAI({
        apiKey: process.env['OPENAI_API_KEY']
    });

    const firstSystemPrompt = `ユーザの入力に対して適切な回答を返すプロンプトを遺伝的アルゴリズムを使ってチューニングします。
1つ目のプロンプトを「システムプロンプト」、2つ目のプロンプトを「チューニングプロンプト」と呼びます。
オリジナルの「チューニングプロンプト」を改良する形で新たな5つのプロンプトを作成してください。
------
・オリジナルの「チューニングプロンプト」の意図を理解し、より良い回答を返すために改良してください
・オリジナルの「チューニングプロンプト」の重要な情報が失われないように十分に注意してください
・これらの5つのプロンプトはそれぞれ独立して評価されます`;
    
    const completion = await client.beta.chat.completions.parse({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [
            { role: 'system', content: firstSystemPrompt },
            { role: 'system', content: session.systemPrompt },
        ],
        response_format: zodResponseFormat(Response, 'response'),
    });

    const message = completion.choices[0]?.message;
    if (!message?.parsed) {
        return {
            token: completion.usage?.total_tokens
        };
    }

    const prompts = message.parsed.prompts;
    const steps = await getAnswer(prompts, session.userPrompt, client);

    // すべて削除（再生成用）
    await prisma.generation.deleteMany({ 
        where: { 
            userSessionId: Number(id) 
        }
    });

    // 生成
    await prisma.generation.create({
        data: {
            userSessionId: Number(id),
            promptResults: {
                create: steps.map((step, i) => ({
                    prompt: step.prompt,
                    answer: step.answer,
                    promptOrder: i
                }))
            }
        }
    });
    prisma.$disconnect();
    
    return {
        token: completion.usage!.total_tokens + steps.reduce((acc, step) => acc + step.token!, 0)
    };
}


export async function createNextGeneration(id: string, generation: GenerationWithPrompts) {

    const prisma = new PrismaClient();
    const session = (await prisma.userSession.findFirst({ where: { id: Number(id) } }))!;

    const client = new OpenAI({
        apiKey: process.env['OPENAI_API_KEY']
    });

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
    
    const messages = [
        { role: 'system', content: firstSystemPrompt },
        { role: 'system', content: session.systemPrompt },
        { role: 'system', content: generation.promptResults.map(p => p.prompt + "\n" + generation.additionalPrompt).join("\n------\n") },
    ].filter(p => p.content !== "");
    console.log(messages);

    const completion = await client.beta.chat.completions.parse({
        model: 'gpt-4o-mini-2024-07-18',
        messages: [
            { role: 'system', content: firstSystemPrompt },
            { role: 'system', content: session.systemPrompt },
            { role: 'system', content: generation.promptResults.map(p => p.prompt + "\n" + generation.additionalPrompt).join("\n------\n") },
        ].filter(p => p.content !== "") as ChatCompletionMessage[],
        response_format: zodResponseFormat(Response, 'response'),
    });

    const message = completion.choices[0]?.message;
    if (!message?.parsed) {
        return {
            token: completion.usage?.total_tokens
        };
    }

    // この世代以降を削除（再生成用）
    await prisma.generation.deleteMany({ 
        where: { 
            userSessionId: Number(id),
            id: {
                gte: generation.id
            }
        }
    });
    
    // 生成
    await prisma.generation.create({
        data: {
            userSessionId: Number(id),
            additionalPrompt: generation.additionalPrompt,
            promptResults: {
                create: generation.promptResults.map((step, i) => ({
                    prompt: step.prompt,
                    answer: step.answer,
                    promptOrder: i
                }))
            }
        }
    });

    // 回答を生成して保存
    const prompts = message.parsed.prompts;
    const steps = await getAnswer(prompts, session.userPrompt, client);
    await prisma.generation.create({
        data: {
            // id: generation.id + 1,
            userSessionId: Number(id),
            promptResults: {
                create: steps.map((step, i) => ({
                    prompt: step.prompt,
                    answer: step.answer,
                    promptOrder: i
                }))
            }
        }
    });
    prisma.$disconnect();

    return {
        token: completion.usage?.total_tokens
    };
}

export async function load(id: number) {
    const client = new PrismaClient();
    const steps = await client.userSession.findFirst({ 
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
    client.$disconnect();
    return steps;
}

async function getAnswer(systemPrompts: string[], userPrompt: string, client: OpenAI) {
   
    const tasks = [];
    for (const systemPrompt of systemPrompts) {
        const task = client.chat.completions.create({
            model: 'gpt-4o-mini-2024-07-18',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'system', content: userPrompt },
            ],
        });
        tasks.push(task);
    }

    const results = await Promise.all(tasks);
    return results.map((result, i) => ({
        prompt: systemPrompts[i],
        answer: result.choices[0]!.message.content!,
        token: result.usage?.total_tokens || 0
    }));
}