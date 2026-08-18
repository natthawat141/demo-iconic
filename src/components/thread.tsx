"use client";

import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/attachment";
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
import { TooltipIconButton } from "@/components/tooltip-icon-button";
import { AiLoader } from "@/components/ui/ai-loader";
import { Button } from "@/components/ui/button";
import { VoiceConversation } from "@/components/voice-conversation";
import { cn } from "@/lib/utils";
import type { UIMessage } from "ai";
import {
  ActionBarMorePrimitive,
  ActionBarPrimitive,
  AuiIf,
  type AssistantState,
  ComposerPrimitive,
  ErrorPrimitive,
  groupPartByType,
  MessagePrimitive,
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
  CopyIcon,
  DownloadIcon,
  MicIcon,
  MoreHorizontalIcon,
  PencilIcon,
  RefreshCwIcon,
  SquareIcon,
  ThumbsDownIcon,
  ThumbsUpIcon,
  Volume2Icon,
  VolumeXIcon,
} from "lucide-react";
import {
  createContext,
  useContext,
  type ComponentType,
  type FC,
  type PropsWithChildren,
  useEffect,
  useState,
} from "react";

export type ThreadGroupPart = MessagePrimitive.GroupedParts.GroupPart;

export type ThreadComponents = {
  AssistantMessage?: ComponentType | undefined;
  Welcome?: ComponentType | undefined;
  ToolFallback?: ToolCallMessagePartComponent | undefined;
  ToolGroup?: ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>> | undefined;
  ReasoningGroup?: ComponentType<PropsWithChildren<{ group: ThreadGroupPart }>> | undefined;
};

export type ThreadProps = {
  components?: ThreadComponents | undefined;
  voice?: {
    messages: UIMessage[];
    status: string;
    onSend: (text: string) => Promise<void>;
  } | undefined;
};

const EMPTY_COMPONENTS: ThreadComponents = {};
const ThreadComponentsContext = createContext<ThreadComponents>(EMPTY_COMPONENTS);

const isNewChatView = (state: AssistantState) =>
  state.thread.messages.length === 0 &&
  (!state.thread.isLoading || state.threads.isLoading);

export const Thread: FC<ThreadProps> = ({ components = EMPTY_COMPONENTS, voice }) => {
  const isEmpty = useAuiState(isNewChatView);
  return (
    <ThreadComponentsContext.Provider value={components}>
      <ThreadRoot isEmpty={isEmpty} voice={voice} />
    </ThreadComponentsContext.Provider>
  );
};

const ThreadRoot: FC<Pick<ThreadProps, "voice"> & { isEmpty: boolean }> = ({ isEmpty, voice }) => {
  const { Welcome = ThreadWelcome } = useContext(ThreadComponentsContext);
  return (
    <ThreadPrimitive.Root
      className="aui-root aui-thread-root bg-background @container flex h-full flex-col"
      style={{
        ["--thread-max-width" as string]: "48rem",
        ["--composer-bg" as string]: "var(--color-background)",
        ["--composer-radius" as string]: "0.75rem",
        ["--composer-padding" as string]: "8px",
      }}
    >
      <ThreadPrimitive.Viewport
        turnAnchor="top"
        data-slot="aui_thread-viewport"
        className="relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll scroll-smooth"
      >
        <div className={cn("mx-auto flex w-full max-w-(--thread-max-width) flex-1 flex-col px-4 pt-6 sm:px-6", isEmpty && "justify-center pb-10")}>
          <AuiIf condition={isNewChatView}><Welcome /></AuiIf>
          <div data-slot="aui_message-group" className="mb-24 flex flex-col gap-y-6 empty:hidden">
            <ThreadPrimitive.Messages>{() => <ThreadMessage />}</ThreadPrimitive.Messages>
          </div>
          <AuiIf condition={(state) => state.thread.isRunning}>
            <div className="mb-4 flex items-center gap-2 px-1 text-xs text-muted-foreground" role="status">
              <AiLoader label="กำลังตอบคำถาม" />
              <span>กำลังคิดและตรวจข้อมูล...</span>
            </div>
          </AuiIf>
          <ThreadPrimitive.ViewportFooter
            className={cn(
              "aui-thread-viewport-footer flex flex-col gap-4 overflow-visible pb-4 md:pb-6",
              !isEmpty && "sticky bottom-0 mt-auto bg-background pt-2",
            )}
          >
            <ThreadScrollToBottom />
            <ThreadFollowupSuggestions />
            <Composer voice={voice} />
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
  <div className="aui-thread-welcome-root mb-5 text-center">
    <h1 className="aui-thread-welcome-message-inner text-balance text-2xl font-semibold tracking-[-0.03em] sm:text-3xl">
      วันนี้ให้ช่วยอะไรดี?
    </h1>
    <p className="mx-auto mt-2 max-w-[40ch] text-sm leading-6 text-muted-foreground">
      ถามน้องฟ้าได้เลย ระบบจะค้น Knowledge ของทีมเมื่อจำเป็น
    </p>
  </div>
);

const Composer: FC<Pick<ThreadProps, "voice">> = ({ voice }) => (
  <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
    <div
      data-slot="aui_composer-shell"
      className="flex w-full flex-col gap-1.5 rounded-[1.35rem] border border-input/80 bg-card/95 p-2.5 shadow-sm transition-[border-color,box-shadow,transform] duration-150 focus-within:-translate-y-px focus-within:border-primary/60 focus-within:shadow-md"
    >
      <ComposerAttachments />
      <ComposerPrimitive.Input
        placeholder="ถามน้องฟ้า..."
        className="aui-composer-input caret-primary placeholder:text-muted-foreground/80 max-h-40 min-h-14 w-full resize-none bg-transparent px-2 py-2.5 text-[15px] leading-6 outline-none"
        rows={1}
        autoFocus
        enterKeyHint="send"
        aria-label="พิมพ์คำถามถึงน้องฟ้า"
      />
      <div className="flex items-center justify-between gap-2 px-0.5 pb-0.5">
        <ComposerAddAttachment />
        <ComposerAction voice={voice} />
      </div>
    </div>
    <p className="mt-2 text-center text-[10px] text-muted-foreground">น้องฟ้าอาจผิดพลาด โปรดตรวจสอบข้อมูลสำคัญ</p>
  </ComposerPrimitive.Root>
);

const ComposerAction: FC<Pick<ThreadProps, "voice">> = ({ voice }) => (
  <div className="aui-composer-action-wrapper flex shrink-0 items-center gap-1">
    {voice ? <VoiceConversation {...voice} /> : null}
    <AuiIf condition={(state) => state.thread.capabilities.dictation}>
      <AuiIf condition={(state) => state.composer.dictation == null}>
        <ComposerPrimitive.Dictate render={<TooltipIconButton tooltip="พูดเพื่อพิมพ์" side="bottom" type="button" variant="ghost" size="icon" className="aui-composer-dictate size-9 rounded-full text-muted-foreground hover:bg-muted" aria-label="พูดเพื่อพิมพ์" />}><MicIcon className="size-4" /></ComposerPrimitive.Dictate>
      </AuiIf>
      <AuiIf condition={(state) => state.composer.dictation != null}>
        <ComposerPrimitive.StopDictation render={<TooltipIconButton tooltip="หยุดรับเสียง" side="bottom" type="button" variant="secondary" size="icon" className="aui-composer-stop-dictation size-9 rounded-full" aria-label="หยุดรับเสียง" />}><SquareIcon className="size-3.5 fill-current" /></ComposerPrimitive.StopDictation>
      </AuiIf>
    </AuiIf>
    <AuiIf condition={(state) => !state.thread.isRunning}>
      <ComposerPrimitive.Send render={<TooltipIconButton tooltip="ส่งคำถาม" side="bottom" type="button" variant="default" size="icon" className="aui-composer-send size-9 rounded-full shadow-sm" aria-label="ส่งคำถาม" />}><ArrowUpIcon className="size-4" /></ComposerPrimitive.Send>
    </AuiIf>
    <AuiIf condition={(state) => state.thread.isRunning}>
      <ComposerPrimitive.Cancel render={<Button type="button" variant="default" size="icon" className="aui-composer-cancel size-9 rounded-full shadow-sm" aria-label="หยุดสร้างคำตอบ" />}><SquareIcon className="size-3.5 fill-current" /></ComposerPrimitive.Cancel>
    </AuiIf>
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
  const hasRenderableContent = useAuiState((state) => state.message.content.some((part) => part.type !== "reasoning"));
  if (!hasRenderableContent) return null;
  return (
    <MessagePrimitive.Root data-slot="aui_assistant-message-root" data-role="assistant" className="fade-in slide-in-from-bottom-1 animate-in relative py-1 duration-150">
      <div data-slot="aui_assistant-message-content" className="max-w-[75ch] text-foreground leading-relaxed wrap-break-word">
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
                return part.status.type === "running"
                  ? <p className="my-2 flex items-center gap-2 text-xs text-muted-foreground"><AiLoader label="กำลังค้นข้อมูล" />กำลังค้นข้อมูล...</p>
                  : <div data-slot="aui_tool-group">{children}</div>;
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
      <div className="flex justify-end pt-1.5">
        <div className="flex items-center gap-1"><MessageSpeechButton /><AnswerFeedback /><AssistantActionBar /></div>
      </div>
    </MessagePrimitive.Root>
  );
};

const AnswerFeedback: FC = () => {
  const messageId = useAuiState((state) => state.message.id);
  const [selected, setSelected] = useState<"up" | "down" | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(value: "up" | "down") {
    if (saving || selected === value) return;
    setSaving(true);
    const response = await fetch(`/api/messages/${messageId}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    setSaving(false);
    if (response.ok) setSelected(value);
  }

  return (
    <div className="flex items-center gap-0.5" aria-label="ให้คะแนนคำตอบ">
      <Button type="button" variant="ghost" size="icon" className={cn("size-7 text-muted-foreground", selected === "up" && "bg-primary/10 text-primary")} onClick={() => void submit("up")} disabled={saving} aria-label="คำตอบมีประโยชน์" title="คำตอบมีประโยชน์"><ThumbsUpIcon className="size-3.5" /></Button>
      <Button type="button" variant="ghost" size="icon" className={cn("size-7 text-muted-foreground", selected === "down" && "bg-destructive/10 text-destructive")} onClick={() => void submit("down")} disabled={saving} aria-label="คำตอบยังไม่ตรง" title="คำตอบยังไม่ตรง"><ThumbsDownIcon className="size-3.5" /></Button>
    </div>
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

const MessageSpeechButton: FC = () => {
  const text = useAuiState((state) => state.message.content
    .map((part) => part.type === "text" ? part.text : "")
    .join(" ")
    .replace(/\s+/g, " ")
    .trim());
  const [speaking, setSpeaking] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  useEffect(() => {
    setSpeechSupported("speechSynthesis" in window);
    return () => window.speechSynthesis?.cancel();
  }, []);

  if (!text || !speechSupported) return null;

  function toggleSpeech() {
    window.speechSynthesis.cancel();
    if (speaking) {
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = /[\u0E00-\u0E7F]/.test(text) ? "th-TH" : "en-US";
    utterance.rate = 0.96;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-7 gap-1.5 px-2 text-xs text-muted-foreground"
      type="button"
      onClick={toggleSpeech}
      aria-label={speaking ? "หยุดอ่านคำตอบ" : "อ่านคำตอบออกเสียง"}
      title={speaking ? "หยุดอ่านคำตอบ" : "อ่านคำตอบออกเสียง"}
    >
      {speaking ? <VolumeXIcon className="size-3.5" /> : <Volume2Icon className="size-3.5" />}
      {speaking ? "หยุดอ่าน" : "ฟังคำตอบ"}
    </Button>
  );
};

const UserFilePart: FileMessagePartComponent = (part) => <div className="py-1"><File {...part} /></div>;
const UserImagePart: ImageMessagePartComponent = (part) => <div className="py-1 [&_[data-slot=image-preview]]:min-h-0 [&_[data-slot=image-root]]:max-w-36 [&_img]:max-h-36 [&_img]:w-auto"><Image {...part} /></div>;

const UserMessage: FC = () => (
  <MessagePrimitive.Root data-slot="aui_user-message-root" className="fade-in slide-in-from-bottom-1 animate-in flex flex-col items-end gap-2 duration-150" data-role="user">
    <UserMessageAttachments />
    <div className="max-w-[85%] rounded-xl bg-muted px-4 py-2.5 text-sm leading-relaxed">
      <MessagePrimitive.Parts components={{ File: UserFilePart, Image: UserImagePart }} />
    </div>
    <div className="flex justify-end"><UserActionBar /></div>
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
