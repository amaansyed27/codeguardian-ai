
import { GitHubFile } from '../types';

const GITHUB_API_BASE = 'https://api.github.com';

// WARNING: For demonstration purposes, a token is hardcoded here to prevent API rate-limiting issues
// in a browser-only environment where process.env is not available.
// In a real-world application, this is a major security risk.
// A GitHub token should NEVER be exposed on the client-side.
// It should be handled securely via a backend proxy or environment variables in a build system.
const GITHUB_TOKEN = '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';

const headers: HeadersInit = {
  'Accept': 'application/vnd.github.v3+json',
};

if (GITHUB_TOKEN) {
  headers['Authorization'] = `Bearer ${GITHUB_TOKEN}`;
}


interface GithubTreeItem {
  path: string;
  type: 'blob' | 'tree';
  sha: string;
  size?: number;
  url: string;
}

interface GithubTreeResponse {
  sha: string;
  url: string;
  tree: GithubTreeItem[];
  truncated: boolean;
}

interface GithubRepoResponse {
  default_branch: string;
}

interface GithubContentResponse {
  content: string;
  encoding: string;
}

// A list of common source code file extensions to prioritize
const SOURCE_CODE_EXTENSIONS = new Set([
    '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', 
    '.cs', '.go', '.rs', '.swift', '.kt', '.kts', '.rb', '.php', '.m', '.scala', 
    '.html', '.css', '.scss', '.less', '.vue', '.svelte'
]);


export const getRepoTree = async (owner: string, repo: string): Promise<GitHubFile[]> => {
  try {
    // 1. Get repo info to find the default branch
    const repoRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, { headers });
    if (!repoRes.ok) {
        if (repoRes.status === 404) throw new Error('Repository not found. Please check the URL.');
        if (repoRes.status === 403) {
            const message = GITHUB_TOKEN
                ? 'GitHub API request forbidden. The provided GITHUB_TOKEN may be invalid or lack necessary permissions.'
                : 'GitHub API rate limit exceeded for unauthenticated requests. Please set a GITHUB_TOKEN environment variable to increase the rate limit.';
            throw new Error(message);
        }
        throw new Error(`Failed to fetch repository data. Status: ${repoRes.status}`);
    }
    const repoData: GithubRepoResponse = await repoRes.json();
    const defaultBranch = repoData.default_branch;

    // 2. Get the tree for the default branch
    const treeRes = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`, { headers });
    if (!treeRes.ok) throw new Error(`Failed to fetch repository file tree. Status: ${treeRes.status}`);

    const treeData: GithubTreeResponse = await treeRes.json();
    
    if (treeData.truncated) {
        console.warn('File tree is truncated. Some files may not be displayed.');
    }
    
    const allFiles: GitHubFile[] = treeData.tree
      .filter((file) => file.type === 'blob' && !!file.path)
      .map(({ path, type, sha }) => ({ path, type, sha }));

    // Prioritize source code files
    const sourceFiles = allFiles.filter(file => SOURCE_CODE_EXTENSIONS.has(file.path.substring(file.path.lastIndexOf('.'))));
    const otherFiles = allFiles.filter(file => !SOURCE_CODE_EXTENSIONS.has(file.path.substring(file.path.lastIndexOf('.'))));
    
    return [...sourceFiles, ...otherFiles];

  } catch (error) {
    console.error('GitHub API Error:', error);
    if(error instanceof Error) {
        throw new Error(`Could not retrieve repository files: ${error.message}`);
    }
    throw new Error('An unknown error occurred while fetching repository files.');
  }
};

export const getFileContent = async (owner: string, repo: string, path: string): Promise<string> => {
  try {
    const res = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}`, { headers });
    if (!res.ok) throw new Error(`Failed to fetch file content for ${path}. Status: ${res.status}`);

    const data: GithubContentResponse = await res.json();
    if (data.encoding === 'base64') {
      return atob(data.content);
    }
    throw new Error('Unsupported file encoding received from GitHub.');
  } catch (error) {
    console.error('GitHub API Error:', error);
    if(error instanceof Error) {
        throw new Error(`Could not retrieve file content: ${error.message}`);
    }
    throw new Error('An unknown error occurred while fetching file content.');
  }
};
