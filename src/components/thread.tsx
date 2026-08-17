"use client";

import { UserMessageAttachments } from "@/components/attachment";
import { File } from "@/components/file";
import { ThreadFollowupSuggestions } from "@/components/follow-up-suggestions";
import { Image } from "@/components/image";
import { MarkdownText } from "@/components/markdown-text";
import { KnowledgeSource } from "@/components/knowledge-source";
import {
  Reasoning,
  ReasoningContent,
  ReasoningRoot,
  ReasoningText,
  ReasoningTrigger,
} from "@/components/reasoning";
import { ToolFallback } from "@/components/tool-fallback";
import {
  ToolGroupContent,
  ToolGroupRoot,
  ToolGroupTrigger,
} from "@/components/tool-group";
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AuiIf,
  type AssistantState,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  groupPartByType,
  MessagePrimitive,
  SuggestionPrimitive,
  ThreadPrimitive,
  type FileMessagePartComponent,
  type ImageMessagePartComponent,
  type ToolCallMessagePartComponent,
  useAuiState,
} from "@assistant-ui/react";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  DownloadIcon,
  MicIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  SparklesIcon,
  SquareIcon,
} from "lucide-react";
import {
  createContext,
  useContext,
  type ComponentType,
  type FC,
  type PropsWithChildren,
} from "react";

export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart;

export type ThreadComponents = {
  AssistantMessage?: ComponentType | undefined;
  Welcome?: ComponentType | undefined;
  ToolFallback?: ToolCallMessagePartComponent | undefined;
  ToolGroup?: ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>> | undefined;
  ReasoningGroup?: ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>> | undefined;
};

export type ThreadProps = { components?: ThreadComponents | undefined };

const EMPTY_COMPONENTS: ThreadComponents = {};
const ThreadComponentsContext = createContext<ThreadComponents>(EMPTY_COMPONENTS);

const isNewChatView = (state: AssistantState) =>
  state.thread.messages.length === 0 &&
  (!state.thread.isLoading || state.threads.isLoading);

export const Thread: FC<ThreadProps> = ({ components = EMPTY_COMPONENTS }) => {
  const isEmpty = useAuiState(isNewChatView);
  return (
    <ThreadComponentsContext.Provider value={components}>
      <ThreadRoot isEmpty={isEmpty} />
    </ThreadComponentsContext.Provider>
  );
};

const ThreadRoot: FC<{ isEmpty: boolean }> = ({ isEmpty }) => {
  const { Welcome = ThreadWelcome } = useContext(ThreadComponentsContext);
  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root bg-background @container flex h-full flex-col"
      style={{
        ["--thread-max-width" as string]: "48rem",
        ["--composer-bg" as string]: "color-mix(in oklab, var(--color-muted) 30%, var(--color-background))",
        ["--composer-radius" as string]: "0.875rem",
        ["--composer-padding" as string]: "8px",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        data-slot="aui_thread-viewport"
        className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth"
      >
        <div className={cn("mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-4", isEmpty && "justify-center")}>
          <AuiIf condition={isNewChatView}><Welcome /></AuiIf>
          <div data-slot="aui_message-group" className="mb-14 flex flex-col gap-y-6 empty:hidden">
            <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
          </div>
          <ThreadPrimitive.ViewportFooter
            className={cn(
              "aui-thread-viewport-footer bg-background flex flex-col gap-4 overflow-visible pb-4 md:pb-6",
              !isEmpty && "sticky bottom-0 mt-auto rounded-t-(--composer-radius)",
            )}
          >
            <ThreadScrollToBottom />
            <ThreadFollowupSuggestions />
            <Composer />
            <AuiIf condition={(state) => isNewChatView(state) && state.composer.isEmpty}>
              <ThreadSuggestions />
            </AuiIf>
          </ThreadPrimitive.ViewportFooter>
        </div>
      </ThreadPrimitive.Viewport>
    </ThreadPrimitive.Root>
  );
};

const ThreadMessage: FC = () => {
  const { AssistantMessage: AssistantMessageComponent = AssistantMessage } = useContext(ThreadComponentsContext);
  const role = useAuiState((state) => state.message.role);
  const isEditing = useAuiState((state) => state.message.composer.isEditing);
  if (isEditing) return <EditComposer />;
  if (role === "user") return <UserMessage />;
  return <AssistantMessageComponent />;
};

const ThreadScrollToBottom: FC = () => (
  <ThreadPrimitive.ScrollToBottom render={<TooltipIconButton tooltip="Scroll to bottom" variant="outline" className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible" />}>
    <ArrowDownIcon />
  </ThreadPrimitive.ScrollToBottom>
);

const ThreadWelcome: FC = () => (
  <div className="aui-thread-welcome-root mb-8 flex flex-col items-center px-4 text-center">
    <span className="mb-5 flex size-14 items-center justify-center rounded-2xl bg-secondary text-primary">
      <SparklesIcon className="size-6" aria-hidden="true" />
    </span>
    <p className="mb-2 text-sm font-semibold text-primary">ICONIC Knowledge Assistant</p>
    <h1 className="aui-thread-welcome-message-inner text-balance text-2xl font-bold tracking-[-0.02em] sm:text-[1.75rem]">
      วันนี้อยากให้น้องฟ้าช่วยเรื่องอะไร?
    </h1>
    <p className="mt-2 max-w-[60ch] text-pretty text-sm leading-6 text-muted-foreground">
      ถามจากความรู้ที่ทีมอนุมัติแล้ว น้องฟ้าจะแสดงแหล่งข้อมูลให้ทุกครั้ง และจะไม่เดาเมื่อข้อมูลไม่พอ
    </p>
  </div>
);

const ThreadSuggestions: FC = () => (
  <div className="aui-thread-welcome-suggestions grid w-full gap-2 px-1 sm:grid-cols-3">
    <ThreadPrimitive.Suggestions>{() => <ThreadSuggestionItem />}</ThreadPrimitive.Suggestions>
  </div>
);

const ThreadSuggestionItem: FC = () => (
  <div className="aui-thread-welcome-suggestion-display fade-in slide-in-from-bottom-2 animate-in fill-mode-both duration-200">
    <SuggestionPrimitive.Trigger
      send
      render={<Button variant="ghost" className="aui-thread-welcome-suggestion h-full min-h-20 w-full flex-col items-start justify-center gap-1 rounded-xl bg-muted px-4 py-3 text-left font-normal whitespace-normal transition-colors hover:bg-secondary" />}
    >
      <SuggestionPrimitive.Title className="aui-thread-welcome-suggestion-text-1 text-sm font-semibold" />
      <SuggestionPrimitive.Description className="aui-thread-welcome-suggestion-text-2 text-xs leading-5 text-muted-foreground empty:hidden" />
    </SuggestionPrimitive.Trigger>
  </div>
);

const Composer: FC = () => (
  <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
    <div data-slot="aui_composer-shell" className="border-border/60 focus-within:border-border flex w-full flex-col gap-2 rounded-(--composer-radius) border bg-(--composer-bg) p-(--composer-padding) shadow-[0_4px_16px_-8px_rgba(0,0,0,0.08),0_1px_2px_rgba(0,0,0,0.04)] transition-[border-color,box-shadow] focus-within:shadow-[0_6px_24px_-8px_rgba(0,0,0,0.12),0_1px_2px_rgba(0,0,0,0.05)]">
      <ComposerPrimitive.Input
        placeholder="ถามน้องฟ้าจาก Knowledge ของทีม..."
        className="aui-composer-input caret-primary placeholder:text-muted-foreground/80 max-h-32 min-h-10 w-full resize-none bg-transparent px-2.5 py-1 text-base outline-none"
        rows={1}
        autoFocus
        enterKeyHint="send"
        aria-label="พิมพ์คำถามถึงน้องฟ้า"
      />
      <ComposerAction />
    </div>
  </ComposerPrimitive.Root>
);

const ComposerAction: FC = () => (
  <div className="aui-composer-action-wrapper relative flex items-center justify-end">
    <div className="flex items-center gap-1.5">
      <AuiIf condition={(state) => state.thread.capabilities.dictation}>
        <AuiIf condition={(state) => state.composer.dictation == null}>
          <ComposerPrimitive.Dictate render={<TooltipIconButton tooltip="Voice input" side="bottom" type="button" variant="ghost" size="icon" className="aui-composer-dictate size-7 rounded-full" aria-label="Start voice input" />}><MicIcon className="size-4" /></ComposerPrimitive.Dictate>
        </AuiIf>
      </AuiIf>
      <AuiIf condition={(state) => !state.thread.isRunning}>
        <ComposerPrimitive.Send render={<TooltipIconButton tooltip="ส่งคำถาม" side="bottom" type="button" variant="default" size="icon" className="aui-composer-send size-8 rounded-lg" aria-label="ส่งคำถาม" />}><ArrowUpIcon className="size-4.5" /></ComposerPrimitive.Send>
      </AuiIf>
      <AuiIf condition={(state) => state.thread.isRunning}>
        <ComposerPrimitive.Cancel render={<Button type="button" variant="default" size="icon" className="aui-composer-cancel size-7 rounded-full" aria-label="Stop generating" />}><SquareIcon className="size-3.5 fill-current" /></ComposerPrimitive.Cancel>
      </AuiIf>
    </div>
  </div>
);

const MessageError: FC = () => (
  <MessagePrimitive.Error>
    <ErrorPrimitive.Root className="aui-message-error-root border-destructive bg-destructive/10 text-destructive mt-2 rounded-md border p-3 text-sm">
      <ErrorPrimitive.Message className="line-clamp-2" />
    </ErrorPrimitive.Root>
  </MessagePrimitive.Error>
);

const AssistantMessage: FC = () => {
  const { ToolFallback: ToolFallbackComponent = ToolFallback, ToolGroup, ReasoningGroup } = useContext(ThreadComponentsContext);
  return (
    <MessagePrimitive.Root data-slot="aui_assistant-message-root" data-role="assistant" className="fade-in slide-in-from-bottom-1 animate-in relative pb-2 duration-150">
      <div data-slot="aui_assistant-message-content" className="text-foreground px-2 leading-relaxed wrap-break-word">
        <MessagePrimitive.GroupedParts
          groupBy={groupPartByType({
            reasoning: ["group-chainOfThought", "group-reasoning"],
            "tool-call": ["group-chainOfThought", "group-tool"],
            "standalone-tool-call": [],
          })}
        >
          {({ part, children }) => {
            switch (part.type) {
              case "group-chainOfThought": return <div data-slot="aui_chain-of-thought">{children}</div>;
              case "group-tool":
                if (ToolGroup) return <ToolGroup group={part}>{children}</ToolGroup>;
                return <ToolGroupRoot variant="ghost"><ToolGroupTrigger count={part.indices.length} active={part.status.type === "running"} /><ToolGroupContent>{children}</ToolGroupContent></ToolGroupRoot>;
              case "group-reasoning": {
                if (ReasoningGroup) return <ReasoningGroup group={part}>{children}</ReasoningGroup>;
                const running = part.status.type === "running";
                return <ReasoningRoot streaming={running}><ReasoningTrigger active={running} /><ReasoningContent aria-busy={running}><ReasoningText>{children}</ReasoningText></ReasoningContent></ReasoningRoot>;
              }
              case "text": return <MarkdownText />;
              case "source": return <KnowledgeSource {...part} />;
              case "reasoning": return <Reasoning {...part} />;
              case "tool-call": return part.toolUI ?? <ToolFallbackComponent {...part} />;
              case "data": return part.dataRendererUI;
              case "file": return <div className="py-1"><File {...part} /></div>;
              case "image": return <div className="py-1"><Image {...part} /></div>;
              default: return null;
            }
          }}
        </MessagePrimitive.GroupedParts>
        <MessageError />
      </div>
      <div className="flex items-center justify-between px-2 pt-1.5">
        <BranchPicker />
        <AssistantActionBar />
      </div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => (
  <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" className="aui-assistant-action-bar-root text-muted-foreground flex items-center gap-1">
    <ActionBarPrimitive.Copy render={<TooltipIconButton tooltip="Copy" />}>
      <AuiIf condition={(state) => state.message.isCopied}><CheckIcon /></AuiIf>
      <AuiIf condition={(state) => !state.message.isCopied}><CopyIcon /></AuiIf>
    </ActionBarPrimitive.Copy>
    <ActionBarPrimitive.Reload render={<TooltipIconButton tooltip="Refresh" />}><RefreshCwIcon /></ActionBarPrimitive.Reload>
    <ActionBarMorePrimitive.Root>
      <ActionBarMorePrimitive.Trigger render={<TooltipIconButton tooltip="More" />}><MoreHorizontalIcon /></ActionBarMorePrimitive.Trigger>
      <ActionBarMorePrimitive.Content side="top" align="end" sideOffset={6} className="z-50 min-w-[10rem] overflow-hidden rounded-lg border bg-popover p-1 shadow-md">
        <ActionBarPrimitive.ExportMarkdown render={<ActionBarMorePrimitive.Item className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-muted" />}><DownloadIcon className="size-4" />Export Markdown</ActionBarPrimitive.ExportMarkdown>
      </ActionBarMorePrimitive.Content>
    </ActionBarMorePrimitive.Root>
  </ActionBarPrimitive.Root>
);

const UserFilePart: FileMessagePartComponent = (part) => <div className="py-1"><File {...part} /></div>;
const UserImagePart: ImageMessagePartComponent = (part) => <div className="py-1"><Image {...part} /></div>;

const UserMessage: FC = () => (
  <MessagePrimitive.Root data-slot="aui_user-message-root" className="fade-in slide-in-from-bottom-1 animate-in flex flex-col items-end gap-2 duration-150" data-role="user">
    <UserMessageAttachments />
    <div className="max-w-[85%] rounded-xl bg-muted px-4 py-2.5 text-sm leading-relaxed">
      <MessagePrimitive.Parts components={{ File: UserFilePart, Image: UserImagePart }} />
    </div>
    <div className="flex items-center gap-2"><UserActionBar /><BranchPicker className="justify-end" /></div>
  </MessagePrimitive.Root>
);

const UserActionBar: FC = () => (
  <ActionBarPrimitive.Root hideWhenRunning autohide="not-last" className="aui-user-action-bar-root flex items-center gap-1 text-muted-foreground">
    <ActionBarPrimitive.Edit render={<TooltipIconButton tooltip="Edit" />}><PencilIcon /></ActionBarPrimitive.Edit>
  </ActionBarPrimitive.Root>
);

const EditComposer: FC = () => (
  <MessagePrimitive.Root data-slot="aui_edit-composer-wrapper" className="flex flex-col gap-2">
    <ComposerPrimitive.Root className="ms-auto flex w-full max-w-[85%] flex-col rounded-xl bg-muted p-3">
      <ComposerPrimitive.Input className="min-h-14 w-full resize-none bg-transparent text-sm outline-none" autoFocus />
      <div className="mt-2 flex items-center justify-end gap-2">
        <ComposerPrimitive.Cancel render={<Button variant="ghost" size="sm">ยกเลิก</Button>} />
        <ComposerPrimitive.Send render={<Button size="sm">อัปเดต</Button>} />
      </div>
    </ComposerPrimitive.Root>
  </MessagePrimitive.Root>
);

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({ className, ...rest }) => (
  <BranchPickerPrimitive.Root hideWhenSingleBranch className={cn("aui-branch-picker-root text-muted-foreground inline-flex items-center gap-1 text-xs", className)} {...rest}>
    <BranchPickerPrimitive.Previous render={<TooltipIconButton tooltip="Previous" className="size-6" />}><ChevronLeftIcon /></BranchPickerPrimitive.Previous>
    <span><BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count /></span>
    <BranchPickerPrimitive.Next render={<TooltipIconButton tooltip="Next" className="size-6" />}><ChevronRightIcon /></BranchPickerPrimitive.Next>
  </BranchPickerPrimitive.Root>
);
