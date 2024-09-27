import { useSubmit } from "@remix-run/react";
import { useState } from "react";
import { UserSessionWithGenerations } from "~/services/service";

export function InitialBlock({
    userSession,
    loading, 
    setLoading
} :{ 
    userSession: UserSessionWithGenerations 
    loading: boolean, 
    setLoading: (loading: boolean) => void
}) {

    const sesstionCreated = !!userSession?.id;
    const [initialPrompt, setInitialPrompt] = useState(userSession!.systemPrompt || '');
    const [userQuery, setUserQuery] = useState(userSession!.userPrompt || '');

    const submit = useSubmit();
    
    const handleInitialAnswer = () => {
        setLoading(true);
        submit({ 
            initialPrompt,
            userQuery
        }, {
            method: 'post' 
        });
    };
    
    const handleFirstGeneration = () => {
        setLoading(true);
        submit({ 
            id: userSession?.id
        }, {
            method: 'post' 
        });
    };

    return (
        <div className="bg-white rounded-lg shadow-lg p-8 my-5">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">Prompt Tuning</h1>
          <div className="mb-4">
            <label htmlFor="initialPrompt" className="block text-gray-700 mb-2">Initial Prompt</label>
            <textarea
              id="initialPrompt"
              className={"w-full p-2 border border-gray-300 rounded-md" + (sesstionCreated ? ' bg-gray-100' : '')}
              rows={7}
              placeholder="Enter initial prompt..."
              name="initialPrompt"
              defaultValue={initialPrompt}
              onChange={(e) => setInitialPrompt(e.target.value)}
              readOnly={sesstionCreated}
            />
          </div>
          <div className="mb-6">
            <label htmlFor="userQuery" className="block text-gray-700 mb-2">User Query</label>
            <textarea
              id="userQuery"
              className={"w-full p-2 border border-gray-300 rounded-md" + (sesstionCreated ? ' bg-gray-100' : '')}
              rows={5}
              placeholder="Enter user query..."
              name="userQuery"
              defaultValue={userQuery}
              onChange={(e) => setUserQuery(e.target.value)}
              readOnly={sesstionCreated}
            />
          </div>
          <div className={"flex justify-between" + (sesstionCreated ? ' hidden' : '')}>
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
          <div className={"mb-6" + (!sesstionCreated ? ' hidden' : '')}>
            <label htmlFor="answer" className="block text-gray-700 mb-2">Answer</label>
            <p id="answer" className="block bg-gray-100 text-sm p-3 border rounded-md whitespace-pre-wrap break-all">{userSession?.answer}</p>
          </div>
          <div className={"flex justify-between" + (!sesstionCreated ? ' hidden' : '')}>
            {loading ? (
              <span className="i-mingcute-loading-fill animate-spin text-2xl w-full"></span>
            ) : (
              <button
                className={"bg-blue-600 text-white px-4 py-2 rounded-md"}
                onClick={handleFirstGeneration}
                disabled={!initialPrompt || !userQuery}
              >
                {userSession.generations.length > 0 ? "Regenerate" : "Start Tuning"}
              </button>
            )}
          </div>
        </div>
    );
}