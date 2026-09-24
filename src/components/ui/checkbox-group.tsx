"use client";

import { CheckboxGroup as CheckboxGroupPrimitive } from "@base-ui/react/checkbox-group";
import type { ReactElement } from "react";
import { cn } from "../../lib/cn";

const rootClassName = "flex flex-col items-start gap-3";

export function CheckboxGroup({ className, ...props }: CheckboxGroupPrimitive.Props): ReactElement {
  if (typeof className === "function") {
    return <CheckboxGroupPrimitive className={(state) => cn(rootClassName, className(state))} data-slot="checkbox-group" {...props} />;
  }
  return <CheckboxGroupPrimitive className={cn(rootClassName, className)} data-slot="checkbox-group" {...props} />;
}

export { CheckboxGroupPrimitive };
