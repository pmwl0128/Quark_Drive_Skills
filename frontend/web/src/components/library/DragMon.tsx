/** A portrait (or any small piece of a page) that carries one build: dragged onto a box cell of the
 * library dock, it keeps that build there (design §2.4). The build is read when the drag starts, so a
 * stale snapshot is never kept. Without a build it renders its children unchanged. */
import type { ReactNode } from "react";
import type { TeamMemberDoc } from "@pokemon-champions/protocol";
import { useLibraryDragSource } from "../../lib/library/workspace.tsx";

export function DragMon({ member, name, className = "", children }: {
  member: (() => TeamMemberDoc | null) | null;
  name: string;
  className?: string;
  children: ReactNode;
}) {
  const drag = useLibraryDragSource(() => {
    const value = member?.();
    return value ? { kind: "pokemon", member: value, name } : null;
  }, () => name);
  if (!member) return <span className={className}>{children}</span>;
  return <span className={`${className} lib-drag`.trim()} {...drag}>{children}</span>;
}
