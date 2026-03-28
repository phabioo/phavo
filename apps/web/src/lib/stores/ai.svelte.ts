export type AiProviders = {
  ollama: boolean;
  openai: boolean;
  anthropic: boolean;
};

export type AiStatusResponseData = {
  ollama: boolean;
  openai: boolean;
  anthropic: boolean;
  searchEngineUrl: string;
};

type AiStatusState = {
  searchEngineUrl: string;
  providers: AiProviders;
};

const DEFAULT_SEARCH_ENGINE_URL = 'https://duckduckgo.com/?q={query}';

let aiStatus = $state<AiStatusState>({
  searchEngineUrl: DEFAULT_SEARCH_ENGINE_URL,
  providers: {
    ollama: false,
    openai: false,
    anthropic: false,
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
    searchEngineUrl: payload.searchEngineUrl || DEFAULT_SEARCH_ENGINE_URL,
    providers: {
      ollama: payload.ollama,
      openai: payload.openai,
      anthropic: payload.anthropic,
    },
  });
}
