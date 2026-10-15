import type { ReactNode } from "react";

export function PageHeader({
  title,
  titleAside,
  description,
  children,
  className,
  sticky = false,
}: {
  title: ReactNode;
  /** Controls that belong to the title itself (kept outside the heading element, right after it). */
  titleAside?: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  className?: string;
  /** Keep the title and its controls (the page's tabs) under the top bar while the page scrolls.
   * The lead is not part of it: it sits under the ruled header and scrolls away with the page. */
  sticky?: boolean;
}) {
  const header = (
    <header className={`page-header${sticky ? " page-header-sticky" : ""}${className ? ` ${className}` : ""}`}>
      <div className="page-heading-row">
        {titleAside ? (
          <div className="page-title-group">
            <h1 className="page-title">{title}</h1>
            {titleAside}
          </div>
        ) : <h1 className="page-title">{title}</h1>}
        {children && <div className="page-heading-actions">{children}</div>}
      </div>
      {!sticky && description && <p className="page-lead">{description}</p>}
    </header>
  );
  if (!sticky || !description) return header;
  return <>{header}<p className="page-lead page-lead-detached">{description}</p></>;
}
