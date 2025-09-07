import React, { useState, useCallback, useEffect } from 'react';
import { GitHubFile, ReviewResult, LoadingState, TreeNode } from './types';
import { getRepoTree, getFileContent } from './services/githubService';
import { reviewCode } from './services/geminiService';
import { GitHubIcon, FileIcon, SparklesIcon, ChevronRightIcon, ChevronDownIcon, FolderIcon, KeyIcon, EyeIcon, EyeSlashIcon } from './components/Icons';
import Alert from './components/Alert';
import Loader from './components/Loader';

// --- UTILITY FUNCTIONS ---

const parseGithubUrl = (url: string): { owner: string; repo: string } | null => {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname !== 'github.com') return null;
    const pathParts = urlObj.pathname.split('/').filter(Boolean);
    if (pathParts.length >= 2) {
      const owner = pathParts[0];
      let repo = pathParts[1];
      if (repo.endsWith('.git')) {
        repo = repo.slice(0, -4);
      }
      return { owner, repo };
    }
    return null;
  } catch (error) {
    return null;
  }
};

const buildFileTree = (files: GitHubFile[]): TreeNode[] => {
    const root: TreeNode = { name: 'root', path: '', type: 'tree', children: [] };
    
    files.forEach(file => {
        let currentNode = root;
        file.path.split('/').forEach((part, index, arr) => {
            let childNode = currentNode.children.find(child => child.name === part);

            if (!childNode) {
                const isLastPart = index === arr.length - 1;
                childNode = {
                    name: part,
                    path: arr.slice(0, index + 1).join('/'),
                    type: isLastPart ? 'blob' : 'tree',
                    children: [],
                    sha: isLastPart ? file.sha : undefined,
                };
                currentNode.children.push(childNode);
            }
            currentNode = childNode;
        });
    });

    const sortNodes = (nodes: TreeNode[]) => {
        nodes.sort((a, b) => {
            if (a.type === 'tree' && b.type === 'blob') return -1;
            if (a.type === 'blob' && b.type === 'tree') return 1;
            return a.name.localeCompare(b.name);
        });
        nodes.forEach(node => {
            if (node.type === 'tree') sortNodes(node.children);
        });
    };
    sortNodes(root.children);
    return root.children;
};


// --- UI COMPONENTS ---

const Header: React.FC = () => (
  <header className="mb-6">
    <div className="flex items-center space-x-3">
      <SparklesIcon className="w-8 h-8 text-indigo-400" />
      <h1 className="text-2xl font-bold text-slate-100">Code Guardian AI</h1>
    </div>
    <p className="text-sm text-slate-400 mt-1">AI-powered code review for your GitHub repositories.</p>
  </header>
);

interface ApiKeyInputProps {
    apiKey: string;
    onApiKeyChange: (key: string) => void;
}

const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ apiKey, onApiKeyChange }) => {
    const [isVisible, setIsVisible] = useState(false);

    return (
        <div className="mb-4">
            <label htmlFor="api-key" className="block text-sm font-medium text-slate-400 mb-1">
                Gemini API Key
            </label>
            <div className="relative">
                <KeyIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    id="api-key"
                    type={isVisible ? 'text' : 'password'}
                    value={apiKey}
                    onChange={(e) => onApiKeyChange(e.target.value)}
                    placeholder="Enter your Gemini API key"
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-md py-2 pr-10 pl-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition duration-150 text-slate-200"
                    aria-required="true"
                />
                <button
                    type="button"
                    onClick={() => setIsVisible(!isVisible)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                    aria-label={isVisible ? 'Hide API key' : 'Show API key'}
                >
                    {isVisible ? <EyeSlashIcon className="w-5 h-5" /> : <EyeIcon className="w-5 h-5" />}
                </button>
            </div>
        </div>
    );
};

interface RepoFormProps {
  onSubmit: (owner: string, repo: string) => void;
  isLoading: boolean;
}

const RepoForm: React.FC<RepoFormProps> = ({ onSubmit, isLoading }) => {
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const parsed = parseGithubUrl(url);
    if (parsed) {
      onSubmit(parsed.owner, parsed.repo);
    } else {
      setError('Please enter a valid GitHub repository URL.');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col space-y-3">
      <div className="relative">
         <GitHubIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
         <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://github.com/owner/repo"
          className="w-full bg-slate-800/50 border border-slate-700 rounded-md py-2 pr-3 pl-10 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition duration-150 text-slate-200"
          disabled={isLoading}
        />
      </div>
      <button
        type="submit"
        disabled={isLoading || !url}
        className="w-full flex items-center justify-center bg-indigo-600 text-white font-semibold py-2 px-4 rounded-md hover:bg-indigo-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-150"
      >
        {isLoading ? <Loader text="Fetching..." /> : 'Fetch Repository Files'}
      </button>
      {error && <p className="text-red-400 text-sm mt-1">{error}</p>}
    </form>
  );
};

interface FileNodeProps {
  node: TreeNode;
  onSelect: (file: GitHubFile) => void;
  selectedFilePath: string | null;
  level: number;
}

const FileNode: React.FC<FileNodeProps> = ({ node, onSelect, selectedFilePath, level }) => {
    const [isOpen, setIsOpen] = useState(false);
    const isSelected = selectedFilePath === node.path;

    const handleClick = () => {
        if (node.type === 'tree') {
            setIsOpen(!isOpen);
        } else {
            onSelect({ path: node.path, type: 'blob', sha: node.sha! });
        }
    };

    if (node.type === 'tree') {
        return (
            <li>
                <button onClick={handleClick} className="w-full text-left flex items-center space-x-2 px-3 py-2 rounded-md transition duration-150 text-sm text-slate-300 hover:bg-slate-800 hover:text-slate-100" style={{ paddingLeft: `${0.75 + level * 1.25}rem` }}>
                    {isOpen ? <ChevronDownIcon className="w-4 h-4 flex-shrink-0" /> : <ChevronRightIcon className="w-4 h-4 flex-shrink-0" />}
                    <FolderIcon className="w-5 h-5 flex-shrink-0 text-yellow-500/80" />
                    <span className="truncate flex-1 font-medium">{node.name}</span>
                </button>
                {isOpen && (
                    <ul className="space-y-1 mt-1">
                        {node.children.map((child) => (
                            <FileNode key={child.path} node={child} onSelect={onSelect} selectedFilePath={selectedFilePath} level={level + 1} />
                        ))}
                    </ul>
                )}
            </li>
        );
    }
    
    return (
         <li>
            <button onClick={handleClick} className={`w-full text-left flex items-center space-x-2 px-3 py-2 rounded-md transition duration-150 text-sm ${ isSelected ? 'bg-indigo-600/30 text-indigo-200' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200' }`} style={{ paddingLeft: `${0.75 + level * 1.25}rem` }}>
                <FileIcon className="w-4 h-4 flex-shrink-0 ml-5"/>
                <span className="truncate flex-1">{node.name}</span>
            </button>
        </li>
    );
};


interface FileBrowserProps {
  nodes: TreeNode[];
  onSelect: (file: GitHubFile) => void;
  selectedFilePath: string | null;
}

const FileBrowser: React.FC<FileBrowserProps> = ({ nodes, onSelect, selectedFilePath }) => {
  if (nodes.length === 0) return null;
  return (
    <div className="mt-4 pt-4 border-t border-slate-800 flex-1 overflow-y-auto">
       <h2 className="text-lg font-semibold text-slate-300 mb-2 px-3">File Browser</h2>
       <ul className="space-y-1">
        {nodes.map((node) => (
          <FileNode key={node.path} node={node} onSelect={onSelect} selectedFilePath={selectedFilePath} level={0} />
        ))}
      </ul>
    </div>
  );
};


const WelcomeScreen: React.FC = () => (
    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
        <SparklesIcon className="w-24 h-24 text-slate-600/50 mb-4" />
        <h2 className="text-2xl font-bold text-slate-300">Welcome to Code Guardian AI</h2>
        <p className="mt-2 max-w-md">
            To get started, enter your Gemini API Key, paste a public GitHub repository URL, fetch the files, then select a file to analyze.
        </p>
    </div>
);

interface ReviewPanelProps {
  review: ReviewResult;
  code: string;
  fileName: string;
}

const ReviewPanel: React.FC<ReviewPanelProps> = ({ review, code, fileName }) => {
    const categoryColors: { [key: string]: string } = {
        'Logic': 'bg-blue-900/50 text-blue-300',
        'Security': 'bg-red-900/50 text-red-300',
        'Performance': 'bg-purple-900/50 text-purple-300',
        'Style': 'bg-green-900/50 text-green-300',
        'Readability': 'bg-yellow-900/50 text-yellow-300',
        'Best Practice': 'bg-teal-900/50 text-teal-300',
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-full">
            <div className="bg-slate-950/70 rounded-lg border border-slate-800 overflow-hidden flex flex-col h-full max-h-[calc(100vh-3rem)]">
                <div className="flex items-center p-3 bg-slate-800/50 border-b border-slate-700">
                    <FileIcon className="w-5 h-5 text-slate-400 mr-2" />
                    <h3 className="font-mono text-sm text-slate-300">{fileName}</h3>
                </div>
                <pre className="overflow-auto p-4 text-sm flex-1"><code className="language-js">{code}</code></pre>
            </div>
            <div className="bg-slate-950/70 rounded-lg border border-slate-800 overflow-hidden flex flex-col h-full max-h-[calc(100vh-3rem)]">
                <div className="flex items-center p-3 bg-slate-800/50 border-b border-slate-700">
                    <SparklesIcon className="w-5 h-5 text-indigo-400 mr-2" />
                    <h3 className="font-semibold text-slate-200">AI Review</h3>
                </div>
                <div className="p-4 overflow-y-auto flex-1">
                    <div className="mb-6">
                        <h4 className="font-semibold text-slate-300 mb-2">Summary</h4>
                        <p className="text-slate-400 text-sm">{review.summary}</p>
                    </div>
                    <h4 className="font-semibold text-slate-300 mb-3">Suggestions</h4>
                    {review.suggestions.length > 0 ? (
                        <ul className="space-y-4">
                            {review.suggestions.map((s, index) => (
                                <li key={index} className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${categoryColors[s.category] || 'bg-gray-700 text-gray-300'}`}>
                                            {s.category}
                                        </span>
                                        {s.lineNumber > 0 && <span className="font-mono text-xs text-slate-500">Line: {s.lineNumber}</span>}
                                    </div>
                                    <p className="text-slate-300 mb-2 text-sm">{s.description}</p>
                                    <pre className="bg-slate-900 rounded-md p-3 overflow-x-auto text-sm"><code className="font-mono text-cyan-300">{s.suggestion}</code></pre>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <div className="text-center py-6 px-4 bg-green-900/20 rounded-lg border border-green-700/30">
                            <p className="text-green-300 font-semibold">Excellent! No issues found.</p>
                            <p className="text-slate-400 text-sm mt-1">The AI review determined this file is well-written and follows best practices.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

const RepoReviewPanel: React.FC<{ results: { [key: string]: ReviewResult } }> = ({ results }) => {
    const entries = Object.entries(results) as [string, ReviewResult][];
    const filesWithSuggestions = entries.filter(([, review]) => review.suggestions.length > 0);
    const [openFile, setOpenFile] = useState<string | null>(filesWithSuggestions.length > 0 ? filesWithSuggestions[0][0] : null);

    const categoryColors: { [key: string]: string } = {
        'Logic': 'bg-blue-900/50 text-blue-300', 'Security': 'bg-red-900/50 text-red-300',
        'Performance': 'bg-purple-900/50 text-purple-300', 'Style': 'bg-green-900/50 text-green-300',
        'Readability': 'bg-yellow-900/50 text-yellow-300', 'Best Practice': 'bg-teal-900/50 text-teal-300',
    };
    
    if (filesWithSuggestions.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 p-8">
                <SparklesIcon className="w-24 h-24 text-green-500/50 mb-4" />
                <h2 className="text-2xl font-bold text-slate-300">Excellent!</h2>
                <p className="mt-2 max-w-md">The AI review scanned the repository and found no issues to suggest. Great job!</p>
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col max-h-[calc(100vh-3rem)]">
            <div className="flex items-center p-4 border-b border-slate-800 flex-shrink-0">
                <SparklesIcon className="w-6 h-6 text-indigo-400 mr-3" />
                <div>
                    <h2 className="font-semibold text-xl text-slate-200">Repository Review</h2>
                    <p className="text-sm text-slate-400">Found {filesWithSuggestions.reduce((acc, [, rev]) => acc + rev.suggestions.length, 0)} suggestions across {filesWithSuggestions.length} files.</p>
                </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
                {filesWithSuggestions.map(([filePath, review]) => (
                    <div key={filePath} className="bg-slate-950/70 rounded-lg border border-slate-800 overflow-hidden">
                        <button className="w-full flex items-center justify-between p-4 text-left" onClick={() => setOpenFile(openFile === filePath ? null : filePath)}>
                            <div className="flex items-center space-x-3 truncate"><FileIcon className="w-5 h-5 text-slate-400 flex-shrink-0" /><span className="font-mono text-slate-300 truncate">{filePath}</span></div>
                            <div className="flex items-center space-x-3 flex-shrink-0"><span className="text-sm px-2 py-1 bg-slate-800 rounded-md text-slate-300">{review.suggestions.length} suggestions</span>{openFile === filePath ? <ChevronDownIcon className="w-5 h-5 text-slate-500" /> : <ChevronRightIcon className="w-5 h-5 text-slate-500" />}</div>
                        </button>
                        {openFile === filePath && (
                            <div className="p-6 bg-slate-800/20 border-t border-slate-800">
                                <div className="mb-6"><h4 className="font-semibold text-slate-300 mb-2">Summary</h4><p className="text-slate-400 text-sm">{review.summary}</p></div>
                                <h4 className="font-semibold text-slate-300 mb-3">Suggestions</h4>
                                <ul className="space-y-4">{review.suggestions.map((s, index) => (
                                    <li key={index} className="bg-slate-800/50 rounded-lg border border-slate-700/50 p-4">
                                        <div className="flex items-center justify-between mb-2"><span className={`px-2 py-0.5 text-xs font-semibold rounded-full ${categoryColors[s.category] || 'bg-gray-700 text-gray-300'}`}>{s.category}</span>{s.lineNumber > 0 && <span className="font-mono text-xs text-slate-500">Line: {s.lineNumber}</span>}</div>
                                        <p className="text-slate-300 mb-2 text-sm">{s.description}</p>
                                        <pre className="bg-slate-900 rounded-md p-3 overflow-x-auto text-sm"><code className="font-mono text-cyan-300">{s.suggestion}</code></pre>
                                    </li>))}
                                </ul>
                            </div>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};

// --- MAIN APP COMPONENT ---

const App: React.FC = () => {
  const [loading, setLoading] = useState<LoadingState>(LoadingState.IDLE);
  const [error, setError] = useState<string | null>(null);
  const [apiKey, setApiKey] = useState<string>('');
  
  const [fileTree, setFileTree] = useState<TreeNode[]>([]);
  const [repoOwnerAndName, setRepoOwnerAndName] = useState<{owner: string; repo: string} | null>(null);
  const [selectedFile, setSelectedFile] = useState<GitHubFile | null>(null);
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [review, setReview] = useState<ReviewResult | null>(null);
  const [repoReviewResults, setRepoReviewResults] = useState<{[key: string]: ReviewResult} | null>(null);
  const [reviewProgress, setReviewProgress] = useState<{processed: number, total: number} | null>(null);

  useEffect(() => {
    const storedApiKey = localStorage.getItem('gemini-api-key');
    if (storedApiKey) {
        setApiKey(storedApiKey);
    }
  }, []);

  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    localStorage.setItem('gemini-api-key', key);
  };

  const handleFetchRepo = useCallback(async (owner: string, repo: string) => {
    setLoading(LoadingState.LOADING_REPO);
    setError(null);
    setFileTree([]);
    setSelectedFile(null);
    setFileContent(null);
    setReview(null);
    setRepoReviewResults(null);
    setRepoOwnerAndName({ owner, repo });

    try {
      const repoFiles = await getRepoTree(owner, repo);
      setFileTree(buildFileTree(repoFiles));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(LoadingState.IDLE);
    }
  }, []);

  const handleFileSelect = useCallback(async (file: GitHubFile) => {
    if (selectedFile?.path === file.path || !repoOwnerAndName) return;
    
    if (!apiKey) {
      setError("Please enter your Gemini API Key to analyze files.");
      return;
    }

    setLoading(LoadingState.LOADING_REVIEW);
    setError(null);
    setSelectedFile(file);
    setFileContent(null);
    setReview(null);
    setRepoReviewResults(null);
    
    try {
      const content = await getFileContent(repoOwnerAndName.owner, repoOwnerAndName.repo, file.path);
      setFileContent(content);
      const reviewResult = await reviewCode(file.path, content, apiKey);
      setReview(reviewResult);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(LoadingState.IDLE);
    }
  }, [selectedFile, repoOwnerAndName, apiKey]);

  const handleAnalyzeRepo = useCallback(async () => {
    if (!repoOwnerAndName) return;

    if (!apiKey) {
      setError("Please enter your Gemini API Key to analyze the repository.");
      return;
    }

    setLoading(LoadingState.LOADING_REPO_REVIEW);
    setError(null);
    setSelectedFile(null);
    setReview(null);
    setRepoReviewResults(null);
    
    const allFiles: GitHubFile[] = [];
    const collectFiles = (nodes: TreeNode[]) => {
        for (const node of nodes) {
            if (node.type === 'blob') allFiles.push({ path: node.path, type: 'blob', sha: node.sha! });
            else collectFiles(node.children);
        }
    }
    collectFiles(fileTree);
    
    const SOURCE_CODE_EXTENSIONS = new Set(['.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.swift', '.kt', '.kts', '.rb', '.php', '.m', '.scala', '.html', '.css', '.scss', '.less', '.vue', '.svelte']);
    const filesToReview = allFiles.filter(file => SOURCE_CODE_EXTENSIONS.has(file.path.substring(file.path.lastIndexOf('.'))));
    
    if (filesToReview.length === 0) {
        setError("No reviewable source code files found in this repository.");
        setLoading(LoadingState.IDLE);
        return;
    }

    setReviewProgress({ processed: 0, total: filesToReview.length });
    const results: { [key: string]: ReviewResult } = {};
    
    for (let i = 0; i < filesToReview.length; i++) {
        const file = filesToReview[i];
        try {
            const content = await getFileContent(repoOwnerAndName.owner, repoOwnerAndName.repo, file.path);
            const reviewResult = await reviewCode(file.path, content, apiKey);
            results[file.path] = reviewResult;
        } catch (e) {
            console.error(`Failed to review ${file.path}:`, e);
        } finally {
            setReviewProgress({ processed: i + 1, total: filesToReview.length });
        }
    }

    setRepoReviewResults(results);
    setReviewProgress(null);
    setLoading(LoadingState.IDLE);
}, [repoOwnerAndName, fileTree, apiKey]);


  return (
    <div className="flex h-screen bg-slate-900 font-sans text-slate-300">
      <aside className="w-[400px] flex-shrink-0 bg-slate-950 p-6 flex flex-col border-r border-slate-800">
        <Header />
        <ApiKeyInput apiKey={apiKey} onApiKeyChange={handleApiKeyChange} />
        <RepoForm onSubmit={handleFetchRepo} isLoading={loading === LoadingState.LOADING_REPO} />
        <div className="my-4">
            <button onClick={handleAnalyzeRepo} disabled={loading !== LoadingState.IDLE || fileTree.length === 0 || !apiKey} className="w-full flex items-center justify-center bg-green-700/80 text-white font-semibold py-2 px-4 rounded-md hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed transition duration-150">
                <SparklesIcon className="w-5 h-5 mr-2" />
                Analyze Entire Repo
            </button>
        </div>
        {error && loading !== LoadingState.LOADING_REVIEW && <Alert message={error} />}
        <FileBrowser nodes={fileTree} onSelect={handleFileSelect} selectedFilePath={selectedFile?.path ?? null} />
      </aside>

      <main className="flex-1 p-6 overflow-hidden">
        {loading === LoadingState.IDLE && !repoReviewResults && !selectedFile && <WelcomeScreen />}
        {loading === LoadingState.LOADING_REVIEW && <div className="h-full flex items-center justify-center"><Loader text="Analyzing code with Gemini..."/></div>}
        {loading === LoadingState.LOADING_REPO_REVIEW && <div className="h-full flex items-center justify-center"><Loader text={`Analyzing repository... (${reviewProgress?.processed}/${reviewProgress?.total})`} /></div>}
        
        {loading === LoadingState.IDLE && error && !review && !repoReviewResults && <div className="h-full flex items-center justify-center"><Alert message={error} /></div>}

        {loading === LoadingState.IDLE && repoReviewResults && <RepoReviewPanel results={repoReviewResults} />}
        
        {loading === LoadingState.IDLE && !repoReviewResults && review && fileContent && selectedFile && (
          <ReviewPanel review={review} code={fileContent} fileName={selectedFile.path} />
        )}
      </main>
    </div>
  );
};

export default App;