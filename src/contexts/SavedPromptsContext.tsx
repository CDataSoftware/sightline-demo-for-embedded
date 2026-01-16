import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

export interface SavedPrompt {
  id: string;
  content: string;
  createdAt: Date;
  lastUsedAt?: Date;
}

interface SavedPromptsContextValue {
  prompts: SavedPrompt[];
  savePrompt: (content: string) => void;
  deletePrompt: (id: string) => void;
  updatePrompt: (id: string, content: string) => void;
  isPromptSaved: (content: string) => boolean;
}

const STORAGE_KEY = "sightline-saved-prompts";

const SavedPromptsContext = createContext<SavedPromptsContextValue | null>(null);

function loadFromStorage(): SavedPrompt[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    // Convert date strings back to Date objects
    return parsed.map((p: SavedPrompt) => ({
      ...p,
      createdAt: new Date(p.createdAt),
      lastUsedAt: p.lastUsedAt ? new Date(p.lastUsedAt) : undefined,
    }));
  } catch {
    return [];
  }
}

function saveToStorage(prompts: SavedPrompt[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prompts));
}

export function SavedPromptsProvider({ children }: { children: ReactNode }) {
  const [prompts, setPrompts] = useState<SavedPrompt[]>(() => loadFromStorage());

  // Persist to localStorage whenever prompts change
  useEffect(() => {
    saveToStorage(prompts);
  }, [prompts]);

  const savePrompt = useCallback((content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    // Don't save duplicates
    const exists = prompts.some(p => p.content.toLowerCase() === trimmed.toLowerCase());
    if (exists) return;

    const newPrompt: SavedPrompt = {
      id: `prompt-${Date.now()}`,
      content: trimmed,
      createdAt: new Date(),
    };
    setPrompts(prev => [newPrompt, ...prev]);
  }, [prompts]);

  const deletePrompt = useCallback((id: string) => {
    setPrompts(prev => prev.filter(p => p.id !== id));
  }, []);

  const updatePrompt = useCallback((id: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    setPrompts(prev => prev.map(p =>
      p.id === id ? { ...p, content: trimmed } : p
    ));
  }, []);

  const isPromptSaved = useCallback((content: string) => {
    const trimmed = content.trim().toLowerCase();
    return prompts.some(p => p.content.toLowerCase() === trimmed);
  }, [prompts]);

  return (
    <SavedPromptsContext.Provider
      value={{
        prompts,
        savePrompt,
        deletePrompt,
        updatePrompt,
        isPromptSaved,
      }}
    >
      {children}
    </SavedPromptsContext.Provider>
  );
}

export function useSavedPrompts() {
  const context = useContext(SavedPromptsContext);
  if (!context) {
    throw new Error("useSavedPrompts must be used within a SavedPromptsProvider");
  }
  return context;
}
