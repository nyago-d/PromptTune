import { Generation } from "@prisma/client";
import { type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { redirect, useSubmit } from "@remix-run/react";
import { useEffect, useState } from "react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { load, GenerationWithPrompts, createFirstGeneration, createNextGeneration, createSession } from "~/services/service";

export const meta: MetaFunction = () => {
  return [
    { title: "New Remix App" },
    { name: "description", content: "Welcome to Remix!" },
  ];
};

export async function action({ request } : ActionFunctionArgs) {

  const formData = await request.formData();
  const id = formData.get("id")?.toString();
  const initialPrompt = formData.get("initialPrompt")?.toString();
  const userQuery = formData.get("userQuery")?.toString();
  const generationJson = formData.get("generation")?.toString();

  if (!id) {
    const { id , token } = await createSession(initialPrompt!, userQuery!);
    console.dir(token, { depth: null });
    return redirect(`/tune/${id}/`);
  } else if (!generationJson) {
    const { token } = await createFirstGeneration(id);
    console.dir(token, { depth: null });
    return redirect(`/tune/${id}/`);
  } else {
    const generation = JSON.parse(generationJson) as GenerationWithPrompts;
    const { token } = await createNextGeneration(id, generation);
    console.dir(token, { depth: null });
    return redirect(`/tune/${id}/`);
  }
}

export async function loader({ params }: LoaderFunctionArgs) {
  
  if (!params.id) {
    return typedjson({ 
      userSession: {
        id: null,
        systemPrompt: '',
        userPrompt: '',
        answer: '',
        generations: []
      } 
    });
  }

  const id = Number(params.id);
  const userSession = await load(id);

  return typedjson({ 
    userSession 
  });
}

export default function Index() {

  const { userSession } = useTypedLoaderData<typeof loader>();

  const id = userSession?.id;
  const [initialPrompt, setInitialPrompt] = useState(userSession!.systemPrompt || '');
  const [userQuery, setUserQuery] = useState(userSession!.userPrompt || '');
  const [generations, setGenerations] = useState(userSession!.generations || []);
  const [loading, setLoading] = useState(false);

  const submit = useSubmit();

  useEffect(() => {
    if (userSession?.id) {
      setInitialPrompt(userSession.systemPrompt);
      setUserQuery(userSession.userPrompt);
      setGenerations(userSession.generations);
      document.body.scrollIntoView({ behavior: 'instant', block: 'end' });
      setLoading(false);
    }
  }, [userSession]);

  const handleInitialAnswer = async () => {
    setLoading(true);
    submit({ 
      initialPrompt,
      userQuery
    }, {
      method: 'post' 
    });
  };

  const handleFirstGeneration = async () => {
    setLoading(true);
    submit({ 
      id: userSession!.id
    }, {
      method: 'post' 
    });
  };

  const handleNextGeneration = (generation: Generation) => {
    setLoading(true);
    submit({ 
      id: userSession!.id, 
      generation: JSON.stringify(generation) 
    }, {
      method: 'post' 
    });
  };

  const handleUp = (genIndex: number, resultIndex: number) => {
    const newGenerations = [...generations];
    const target = newGenerations.at(genIndex);
    [target!.promptResults[resultIndex - 1], target!.promptResults[resultIndex]] = [target!.promptResults[resultIndex], target!.promptResults[resultIndex - 1]];
    setGenerations(newGenerations);
  };

  const handleDown = (genIndex: number, resultIndex: number) => {
    const newGenerations = [...generations];
    const target = newGenerations.at(genIndex);
    [target!.promptResults[resultIndex], target!.promptResults[resultIndex + 1]] = [target!.promptResults[resultIndex + 1], target!.promptResults[resultIndex]];
    setGenerations(newGenerations);
  };

  const handleRemove = (genIndex: number, resultIndex: number) => {
    const newGenerations = [...generations];
    const target = newGenerations.at(genIndex);
    target!.promptResults.splice(resultIndex, 1);
    setGenerations(newGenerations);
  };

  return (
    <div className="flex justify-center min-h-screen h-full bg-gray-100">
      <div className="w-full max-w-7xl">

        <div className="bg-white rounded-lg shadow-lg p-8 my-5">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Prompt Tuning</h1>
          <div className="mb-4">
            <label htmlFor="initialPrompt" className="block text-gray-700 mb-2">Initial Prompt</label>
            <textarea
              id="initialPrompt"
              className={"w-full p-2 border border-gray-300 rounded-md" + (id ? ' bg-gray-100' : '')}
              rows={7}
              placeholder="Enter initial prompt..."
              name="initialPrompt"
              defaultValue={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              readOnly={!!id}
            />
          </div>
          <div className="mb-6">
            <label htmlFor="userQuery" className="block text-gray-700 mb-2">User Query</label>
            <textarea
              id="userQuery"
              className={"w-full p-2 border border-gray-300 rounded-md" + (id ? ' bg-gray-100' : '')}
              rows={5}
              placeholder="Enter user query..."
              name="userQuery"
              defaultValue={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              readOnly={!!id}
            />
          </div>
          <div className={"flex justify-between" + (id ? ' hidden' : '')}>
            {loading ? (
              <span className="i-mingcute-loading-fill animate-spin text-2xl w-full"></span>
            ) : (
              <button
                className={"bg-blue-600 text-white px-4 py-2 rounded-md" + (!!initialPrompt && !!userQuery ? '' : ' opacity-50 cursor-not-allowed')}
                onClick={handleInitialAnswer}
                disabled={!initialPrompt || !userQuery}
              >
                Get Answer
              </button>
            )}
          </div>
          <div className={"mb-6" + (!id ? ' hidden' : '')}>
            <label htmlFor="answer" className="block text-gray-700 mb-2">Answer</label>
            <p id="answer" className="block bg-gray-100 text-sm p-3 border rounded-md whitespace-pre-wrap break-all">{userSession?.answer}</p>
          </div>
          <div className={"flex justify-between" + (!id ? ' hidden' : '')}>
            {loading ? (
              <span className="i-mingcute-loading-fill animate-spin text-2xl w-full"></span>
            ) : (
              <button
                className={"bg-blue-600 text-white px-4 py-2 rounded-md"}
                onClick={handleFirstGeneration}
                disabled={!initialPrompt || !userQuery}
              >
                {generations.length > 0 ? "Regenerate" : "Start Tuning"}
              </button>
            )}
          </div>
        </div>

        {generations.map((generation, index) => (
          <div key={index} className="bg-white rounded-lg shadow-lg p-8 w-full max-w-7xl my-5">
            <h1 className="text-2xl font-bold text-gray-800 mb-4">Generation {index + 1}</h1>
            <ul className="space-y-2 mb-6">
              {generation!.promptResults.map((prompt, index2) => (
                <li
                  key={index2}
                  className="border border-gray-200 rounded-md p-0"
                >
                  <div className="block text-gray-500 text-sm p-3 flex justify-between">
                    <p className="w-11/12">{prompt.prompt}</p>
                    <p className="text-xl inline h-0 ml-5 cursor-pointer">
                      <button className={"i-material-symbols-arrow-circle-up-outline" + (index2 === 0 ? " invisible" : "")} onClick={() => handleUp(index, index2)}></button>
                      <button className={"i-material-symbols-arrow-circle-down-outline mx-2" + (index2 === generation!.promptResults.length - 1 ? " invisible" : "")} onClick={() => handleDown(index, index2)}></button>
                      <button className="i-material-symbols-close" onClick={() => handleRemove(index, index2)}></button>
                    </p>
                  </div>
                  <p className="block bg-gray-100 text-sm p-3 border-t whitespace-pre-wrap break-all">{prompt.answer}</p>
                </li>
              ))}
            </ul>
            
            <label htmlFor={"additionalPrompt" + index} className="block text-gray-700 mb-2">Additional Prompt</label>
            <input
              type="text"
              id={"additionalPrompt" + index} 
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              defaultValue={generation.additionalPrompt || ""} 
              onChange={(e) => {
                generations[index].additionalPrompt = e.target.value; 
                setGenerations(generations);
              }}
            />

            <div className="flex justify-between mt-5">
            {loading ? (
              <span className="i-mingcute-loading-fill animate-spin text-2xl w-full"></span>
            ) : (
              <button
                className="bg-blue-600 text-white px-4 py-2 rounded-md"
                onClick={() => handleNextGeneration(generation)}
              >
                {generation === generations.at(-1) ? "Next Generation" : "Regenerate"}
              </button>
            )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
