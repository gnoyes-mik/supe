import { simpleGit, type SimpleGit } from 'simple-git';

export function createGit(workdir: string): SimpleGit {
  return simpleGit(workdir);
}

export async function initRepo(workdir: string, branch: string): Promise<SimpleGit> {
  const git = createGit(workdir);
  await git.init();
  await git.checkoutLocalBranch(branch);
  return git;
}

export async function getCommitCount(git: SimpleGit): Promise<number> {
  try {
    const log = await git.log();
    return log.total;
  } catch {
    return 0;
  }
}

export async function getLatestCommitMessage(git: SimpleGit): Promise<string> {
  try {
    const log = await git.log({ maxCount: 1 });
    return log.latest?.message ?? '';
  } catch {
    return '';
  }
}

export async function getFileCount(git: SimpleGit): Promise<number> {
  try {
    const files = await git.raw(['ls-files']);
    return files.trim().split('\n').filter(Boolean).length;
  } catch {
    return 0;
  }
}

export async function getDiffSince(git: SimpleGit, sinceHash: string): Promise<string> {
  try {
    const currentHash = await git.revparse(['HEAD']);
    if (sinceHash === currentHash.trim()) return '';
    const diff = await git.diff([`${sinceHash}..HEAD`]);
    return diff;
  } catch {
    return '';
  }
}

export async function getCommitsSince(git: SimpleGit, sinceHash: string): Promise<string[]> {
  try {
    const log = await git.log({ from: sinceHash, to: 'HEAD' });
    return log.all.map(c => c.message);
  } catch {
    return [];
  }
}

export async function getCurrentHash(git: SimpleGit): Promise<string> {
  try {
    const hash = await git.revparse(['HEAD']);
    return hash.trim();
  } catch {
    return '';
  }
}
