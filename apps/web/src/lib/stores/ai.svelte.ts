export type AiProvider = 'ollama' | 'openai' | 'anthropic' | 'google' | 'custom' | null;

export type AiProviders = {
  ollama: boolean;
  openai: boolean;
  anthropic: boolean;
  google: boolean;
  custom: boolean;
};

export type AiStatusResponseData = {
  aiProvider: AiProvider;
  ollama: boolean;
  openai: boolean;
  anthropic: boolean;
  google: boolean;
  custom: boolean;
  searchEngineUrl: string;
};

type AiStatusState = {
  aiProvider: AiProvider;
  searchEngineUrl: string;
  providers: AiProviders;
};

const DEFAULT_SEARCH_ENGINE_URL = 'https://duckduckgo.com/?q={query}';

let aiStatus = $state<AiStatusState>({
  aiProvider: null,
  searchEngineUrl: DEFAULT_SEARCH_ENGINE_URL,
  providers: {
    ollama: false,
    openai: false,
    anthropic: false,
    google: false,
    custom: false,
  },
});

export function getAiStatus(): AiStatusState {
  return aiStatus;
}

export function setAiStatus(nextStatus: AiStatusState): void {
  aiStatus = nextStatus;
}

export function updateAiStatusFromPayload(payload: AiStatusResponseData): void {
  setAiStatus({
    aiProvider: payload.aiProvider ?? null,
    searchEngineUrl: payload.searchEngineUrl || DEFAULT_SEARCH_ENGINE_URL,
    providers: {
      ollama: payload.ollama,
      openai: payload.openai,
      anthropic: payload.anthropic,
      google: payload.google ?? false,
      custom: payload.custom ?? false,
    },
  });
}
