/**
 * Type stubs for the openclaw plugin SDK.
 * These types mirror the actual SDK surface used by claw-doing.
 * The real implementation is provided by the openclaw host at runtime.
 */
declare module "openclaw/plugin-sdk/plugin-entry" {
  import type { TSchema } from "@sinclair/typebox";

  export interface ToolContent {
    type: "text" | "image";
    text?: string;
    data?: string;
    mediaType?: string;
  }

  export interface ToolResult {
    content: ToolContent[];
    isError?: boolean;
  }

  export interface RegisterToolOptions {
    optional?: boolean;
  }

  export interface ToolDefinition<TParams = Record<string, unknown>> {
    name: string;
    description: string;
    parameters: TSchema;
    execute: (id: string, params: TParams) => Promise<ToolResult>;
  }

  export interface HookEvent {
    type: string;
    action: string;
    toolName?: string;
    params?: Record<string, unknown>;
    context?: Record<string, unknown>;
  }

  export type HookResult = Record<string, unknown> | void;

  export interface PluginApi {
    registerTool<TParams>(
      definition: ToolDefinition<TParams>,
      options?: RegisterToolOptions
    ): void;
    registerHook(
      event: string,
      handler: (event: HookEvent) => Promise<HookResult>
    ): void;
  }

  export interface PluginDefinition {
    id: string;
    name: string;
    description?: string;
    register: (api: PluginApi) => void;
  }

  export function definePluginEntry(definition: PluginDefinition): PluginDefinition;
}
