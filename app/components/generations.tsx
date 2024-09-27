import { Generation } from "@prisma/client";
import { useSubmit } from "@remix-run/react";
import { useEffect, useState } from "react";
import { GenerationWithPrompts, UserSessionWithGenerations } from "~/services/service";

export function Generations({
    userSession,
    loading, 
    setLoading
} : {
    userSession: UserSessionWithGenerations 
    loading: boolean, 
    setLoading: (loading: boolean) => void
}) {
  
    const [generations, setGenerations] = useState(userSession!.generations || [] satisfies GenerationWithPrompts[]);

    const submit = useSubmit();

    useEffect(() => {
      if (userSession?.id) {
        setGenerations(userSession.generations);
        document.body.scrollIntoView({ behavior: 'instant', block: 'end' });
      }
    }, [userSession]);
    
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

    const handleNextGeneration = (generation: Generation) => {
      setLoading(true);
      submit({ 
        id: userSession?.id, 
        generation: JSON.stringify(generation) 
      }, {
        method: 'post' 
      });
    };

    return (
        generations.map((generation, generationIndex) => (
          <div key={generationIndex} className="bg-white rounded-lg shadow-lg p-8 w-full max-w-7xl my-5">

            <h1 className="text-2xl font-bold text-gray-800 mb-4">Generation {generationIndex + 1}</h1>
            <ul className="space-y-2 mb-6">
              {generation!.promptResults.map((prompt, promptIndex) => (
                <li
                  key={promptIndex}
                  className="border border-gray-200 rounded-md p-0"
                >
                  <div className="block text-gray-500 text-sm p-3 flex justify-between">
                    <p className="w-11/12">{prompt.prompt}</p>
                    <p className="text-xl inline h-0 ml-5 cursor-pointer">
                      <button className={"i-material-symbols-arrow-circle-up-outline" + (promptIndex === 0 ? " invisible" : "")} onClick={() => handleUp(generationIndex, promptIndex)}></button>
                      <button className={"i-material-symbols-arrow-circle-down-outline mx-2" + (promptIndex === generation!.promptResults.length - 1 ? " invisible" : "")} onClick={() => handleDown(generationIndex, promptIndex)}></button>
                      <button className="i-material-symbols-close" onClick={() => handleRemove(generationIndex, promptIndex)}></button>
                    </p>
                  </div>
                  <p className="block bg-gray-100 text-sm p-3 border-t whitespace-pre-wrap break-all">{prompt.answer}</p>
                </li>
              ))}
            </ul>
            
            <label htmlFor={"additionalPrompt" + generationIndex} className="block text-gray-700 mb-2">Additional Prompt</label>
            <input
              type="text"
              id={"additionalPrompt" + generationIndex} 
              className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-full p-2.5 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
              defaultValue={generation.additionalPrompt || ""} 
              onChange={(e) => {
                generations[generationIndex].additionalPrompt = e.target.value; 
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
        ))
    );
}