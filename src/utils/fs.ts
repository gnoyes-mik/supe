import { cp, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

/** 디렉토리 복사 (node 16.7+ cp recursive) */
export async function copyDir(src: string, dest: string): Promise<void> {
  await cp(src, dest, { recursive: true });
}

/** 기존 .gitignore에 .supe/ 추가 (없으면 새로 생성) */
export async function appendToGitignore(workdir: string): Promise<void> {
  const gitignorePath = join(workdir, '.gitignore');
  let content = '';
  try {
    content = await readFile(gitignorePath, 'utf-8');
  } catch { /* 파일 없음 */ }

  if (!content.includes('.supe/')) {
    const separator = content.length > 0 && !content.endsWith('\n') ? '\n' : '';
    await writeFile(gitignorePath, content + separator + '.supe/\n');
  }
}
