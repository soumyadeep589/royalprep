export function ErrorMessage({text}:{text:string}){return text?<p role="alert" className="error">{text}</p>:null}
