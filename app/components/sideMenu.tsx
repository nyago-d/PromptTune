import { Link } from "@remix-run/react";

export function SideMenu({ histories } : { histories : { id: number, systemPrompt: string, current: boolean }[] }) {
    
    return (
        <div className="bg-white rounded-lg shadow-lg p-8 my-5">
            <Link to="/tune/" className="text-gray-600 hover:text-gray-800" reloadDocument>
                <p className="p-2 h-10 w-full rounded-md hover:bg-gray-100 truncate ...">
                    <i className="i-material-symbols-edit-document-outline mr-2 align-text-bottom"></i>
                    <span>New Session</span>
                </p>
            </Link>
            {histories.map((history, i) => (
                <Link key={i} to={`/tune/${history.id}/`} className={"text-gray-600 hover:text-gray-800" + (history.current ? " text-gray-800" : "")} reloadDocument>
                    <p className={"p-2 h-10 w-full rounded-md hover:bg-gray-100 truncate ..." + (history.current ? " bg-gray-100" : "")}>
                        {history.systemPrompt}
                    </p>
                </Link>
            ))}
        </div>
    );
}