
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      GEMINI_API_KEY: string;
      GITHUB_TOKEN: string;
    }
  }
}

export interface GitHubFile {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
}

export interface TreeNode {
  name: string;
  path: string;
  type: 'tree' | 'blob';
  children: TreeNode[];
  sha?: string;
}

export interface Suggestion {
  lineNumber: number;
  category: string;
  description: string;
  suggestion: string;
}

export interface ReviewResult {
  summary: string;
  suggestions: Suggestion[];
}

export enum LoadingState {
  IDLE,
  LOADING_REPO,
  LOADING_REVIEW,
  LOADING_REPO_REVIEW,
}