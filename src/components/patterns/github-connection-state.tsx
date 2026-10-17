import type { ElementType } from "react";
import { Gear } from "@phosphor-icons/react";
import { Button } from "../ui/button";
import { Empty, EmptyContent, EmptyDescription, EmptyIcon, EmptyTitle } from "../ui/empty";

export function GithubConnectionState({ icon: Icon, title, description, actionLabel, onConnect }: {
  icon: ElementType;
  title: string;
  description: string;
  actionLabel: string;
  onConnect: () => void;
}) {
  return (
    <Empty className="sb-connection-state">
      <EmptyContent>
        <EmptyIcon><Icon className="size-6" aria-hidden="true" /></EmptyIcon>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
        <Button type="button" className="mt-5" onClick={onConnect}>
          <Gear className="size-4" aria-hidden="true" />{actionLabel}
        </Button>
      </EmptyContent>
    </Empty>
  );
}
