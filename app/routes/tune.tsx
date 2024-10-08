import { type ActionFunctionArgs, type LoaderFunctionArgs, type MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/react";
import { useEffect, useState } from "react";
import { typedjson, useTypedLoaderData } from "remix-typedjson";
import { Generations } from "~/components/generations";
import { InitialBlock } from "~/components/initialBlock";
import { SideMenu } from "~/components/sideMenu";
import { loadSession, GenerationWithPrompts, makeFirstGeneration, makeNextGeneration, createSession, UserSessionWithGenerations, loadHistories } from "~/services/service";

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
    const { token } = await makeFirstGeneration(id);
    console.dir(token, { depth: null });
    return redirect(`/tune/${id}/#generation1`);
  } else {
    const generation = JSON.parse(generationJson) as GenerationWithPrompts;
    const { token, generationCount } = await makeNextGeneration(id, generation);
    console.dir(token, { depth: null });
    return redirect(`/tune/${id}/#generation${generationCount}`);
  }
}

export async function loader({ params }: LoaderFunctionArgs) {
  
  const histories = (await loadHistories()).map(h => ( { ...h, current: h.id === Number(params.id) }));

  if (!params.id) {
    return typedjson({ 
      histories,
      userSession: {
        id: null,
        systemPrompt: '',
        userPrompt: '',
        answer: '',
        generations: []
      } 
    });
  }

  const userSession = await loadSession(Number(params.id));

  return typedjson({ 
    histories,
    userSession 
  });
}

export default function Index() {

  const { histories, userSession } = useTypedLoaderData<typeof loader>();

  const [loading, setLoading] = useState(false);

  useEffect(() => {        
    setLoading(false);
  }, [userSession, setLoading]);

  return (
    <div className="flex gap-x-5 justify-center min-h-screen h-full bg-gray-100">
      <div className="w-full max-w-md">
        <SideMenu histories={histories} />
      </div>
      <div className="w-full max-w-7xl">
        <InitialBlock
          userSession={userSession as UserSessionWithGenerations}
          loading={loading}
          setLoading={setLoading} />
        <Generations 
          userSession={userSession as UserSessionWithGenerations}
          loading={loading}
          setLoading={setLoading} />
      </div>
    </div>
  );
}
