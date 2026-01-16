import { useState } from "react";
import { Bookmark, Play, Pencil, Trash2, X, Check, ChevronRight, BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useSavedPrompts, SavedPrompt } from "@/contexts/SavedPromptsContext";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SavedPromptsPanelProps {
  onRunPrompt: (content: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

function PromptItem({
  prompt,
  onRun,
  onDelete,
  onUpdate,
}: {
  prompt: SavedPrompt;
  onRun: (content: string) => void;
  onDelete: (id: string) => void;
  onUpdate: (id: string, content: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(prompt.content);

  const handleSave = () => {
    if (editValue.trim()) {
      onUpdate(prompt.id, editValue);
      setIsEditing(false);
    }
  };

  const handleCancel = () => {
    setEditValue(prompt.content);
    setIsEditing(false);
  };

  return (
    <div className="group relative p-4 rounded-xl bg-card border border-border hover:border-primary/30 hover:shadow-md transition-all duration-200">
      {isEditing ? (
        <div className="space-y-3">
          <textarea
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-border bg-background resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-all"
            rows={4}
            autoFocus
          />
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancel}
              className="h-8 px-3 text-xs"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              className="h-8 px-3 text-xs gradient-primary"
            >
              <Check className="h-3.5 w-3.5 mr-1" />
              Save
            </Button>
          </div>
        </div>
      ) : (
        <>
          <p className="text-sm text-foreground leading-relaxed line-clamp-3 pr-8">
            {prompt.content}
          </p>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
            <span className="text-xs text-muted-foreground">
              {prompt.createdAt.toLocaleDateString(undefined, { 
                month: 'short', 
                day: 'numeric',
                year: prompt.createdAt.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
              })}
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onRun(prompt.content)}
                className="h-8 px-2.5 text-primary hover:text-primary hover:bg-primary/10"
                title="Use prompt"
              >
                <Play className="h-3.5 w-3.5 mr-1" />
                <span className="text-xs">Use</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(true)}
                className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Edit prompt"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(prompt.id)}
                className="h-8 w-8 p-0 text-destructive/70 hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 transition-opacity"
                title="Delete prompt"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export function SavedPromptsPanel({ onRunPrompt, isOpen, onToggle }: SavedPromptsPanelProps) {
  const { prompts, deletePrompt, updatePrompt } = useSavedPrompts();

  return (
    <div className="relative h-full flex">
      {/* Toggle Button - positioned relative to the outer container, not the scrollable panel */}
      <button
        onClick={onToggle}
        className={cn(
          "absolute top-1/2 -translate-y-1/2 z-10 flex items-center justify-center transition-all duration-300",
          "rounded-l-xl shadow-lg border border-r-0",
          isOpen
            ? "w-6 h-16 bg-card border-border hover:bg-muted right-80"
            : "w-10 h-24 gradient-primary border-primary/20 hover:opacity-90 right-0",
          !isOpen && prompts.length > 0 && "animate-pulse [animation-duration:3s]"
        )}
        title={isOpen ? "Close saved prompts" : "Open saved prompts"}
      >
        {isOpen ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        ) : (
          <div className="flex flex-col items-center gap-1.5">
            <Bookmark className="h-4 w-4 text-primary-foreground" />
            <span className="text-[10px] font-medium text-primary-foreground [writing-mode:vertical-lr] rotate-180">
              Prompts
            </span>
            {prompts.length > 0 && (
              <span className="text-[9px] font-bold bg-primary-foreground/20 text-primary-foreground rounded-full px-1.5">
                {prompts.length}
              </span>
            )}
          </div>
        )}
      </button>

      {/* Panel */}
      <div
        className={cn(
          "h-full border-l border-border bg-background/95 backdrop-blur-sm flex flex-col transition-all duration-300 ml-auto",
          isOpen ? "w-80" : "w-0 overflow-hidden"
        )}
      >
        {/* Header */}
        <div className="p-5 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Bookmark className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="font-semibold text-sm">Saved Prompts</h2>
              <p className="text-xs text-muted-foreground">{prompts.length} saved</p>
            </div>
          </div>
        </div>

        {/* Prompts List */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-3">
            {prompts.length === 0 ? (
              <div className="text-center py-12 px-4">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-4 animate-scale-in">
                  <BookmarkPlus className="h-7 w-7 text-muted-foreground/50" />
                </div>
                <h3 className="font-medium text-sm text-foreground mb-1">No saved prompts</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Click the bookmark icon on any of your messages to save it for later
                </p>
              </div>
            ) : (
              prompts.map((prompt, index) => (
                <div 
                  key={prompt.id}
                  className="animate-fade-in"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <PromptItem
                    prompt={prompt}
                    onRun={onRunPrompt}
                    onDelete={deletePrompt}
                    onUpdate={updatePrompt}
                  />
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}
