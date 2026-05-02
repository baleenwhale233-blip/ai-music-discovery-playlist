import Link from "next/link";

export function PageHeader(props: {
  eyebrow?: string;
  title: string;
  description?: string;
  actionHref?: string;
  actionLabel?: string;
}) {
  return (
    <header className="page-header">
      <div>
        {props.eyebrow ? <p className="eyebrow">{props.eyebrow}</p> : null}
        <h1>{props.title}</h1>
        {props.description ? <p className="lead">{props.description}</p> : null}
      </div>
      {props.actionHref && props.actionLabel ? (
        <Link className="button secondary" href={props.actionHref}>{props.actionLabel}</Link>
      ) : null}
    </header>
  );
}
