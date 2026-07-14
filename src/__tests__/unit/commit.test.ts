import { jest } from '@jest/globals';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFn = (...args: any[]) => any;

const fsMock = {
  existsSync: jest.fn<AnyFn>(),
  readFileSync: jest.fn<AnyFn>(),
  statSync: jest.fn<AnyFn>(),
  readdirSync: jest.fn<AnyFn>(),
  openSync: jest.fn<AnyFn>(),
  readSync: jest.fn<AnyFn>(),
  closeSync: jest.fn<AnyFn>(),
};

const getOctokit = jest.fn<AnyFn>();
const context = {
  repo: { owner: 'test-owner', repo: 'test-repo' },
  ref: 'refs/heads/main',
};

jest.unstable_mockModule('fs', () => ({ ...fsMock, default: fsMock }));
jest.unstable_mockModule('@actions/github', () => ({ getOctokit, context }));

// Import AFTER the mock registrations above.
const {
  commitViaAPI,
  createBlob,
  createCommit,
  createTree,
  getBranchInfo,
  getFileMode,
  INLINE_CONTENT_SIZE_LIMIT,
  isBinaryFile,
  TREE_ENTRY_BYTE_LIMIT,
  TREE_ENTRY_CHUNK_SIZE,
  updateBranch,
} = await import('../../commit.js');

describe('commit', () => {
  const mockOctokit = {
    rest: {
      git: {
        getRef: jest.fn<AnyFn>(),
        getCommit: jest.fn<AnyFn>(),
        createBlob: jest.fn<AnyFn>(),
        createTree: jest.fn<AnyFn>(),
        createCommit: jest.fn<AnyFn>(),
        updateRef: jest.fn<AnyFn>(),
      },
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // ESM namespaces are frozen, so tests configure this shared mock object
    // instead of reassigning `fs.*`. Reset the implementations too, so each
    // test starts from the same blank slate the old per-test `jest.fn()`
    // reassignment gave it (clearAllMocks only clears call records).
    for (const fn of Object.values(fsMock)) {
      fn.mockReset();
    }
    getOctokit.mockReturnValue(mockOctokit);
    fsMock.openSync.mockReturnValue(1);
    fsMock.closeSync.mockImplementation(() => {});
    fsMock.readSync.mockImplementation(
      (_fd: number, buf: Buffer, offset?: number, length?: number) => {
        const off = offset ?? 0;
        const len = length ?? buf.length - off;
        Buffer.alloc(len, 0x61).copy(buf, off);
        return len;
      }
    );
  });

  describe('createBlob', () => {
    it('should create a blob for a file', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockReturnValue(Buffer.from('test content'));
      fsMock.statSync.mockReturnValue({ mode: 0o644 });

      mockOctokit.rest.git.createBlob.mockResolvedValue({
        data: { sha: 'blob-sha-123' },
      });

      const result = await createBlob(mockOctokit as any, 'owner', 'repo', 'test.txt');

      expect(result.sha).toBe('blob-sha-123');
      expect(result.mode).toBe('100644');
      expect(mockOctokit.rest.git.createBlob).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        content: expect.any(String),
        encoding: 'base64',
      });
    });

    it('should throw error if file does not exist', async () => {
      fsMock.existsSync.mockReturnValue(false);

      await expect(
        createBlob(mockOctokit as any, 'owner', 'repo', 'nonexistent.txt')
      ).rejects.toThrow('File not found');
    });
  });

  describe('createTree', () => {
    it('should return baseTreeSha without calling createTree when filePaths is empty', async () => {
      const result = await createTree(mockOctokit as any, 'owner', 'repo', 'base-tree-sha', []);

      expect(result).toBe('base-tree-sha');
      expect(mockOctokit.rest.git.createTree).not.toHaveBeenCalled();
      expect(mockOctokit.rest.git.createBlob).not.toHaveBeenCalled();
    });

    it('should create a tree with inline content for text files (no createBlob)', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockImplementation((path: string, enc?: string) => {
        if (enc === 'utf-8') {
          return 'content';
        }
        return Buffer.from('content');
      });
      fsMock.statSync.mockReturnValue({ mode: 0o644, size: 7 });

      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: 'tree-sha-123' },
      });

      const result = await createTree(mockOctokit as any, 'owner', 'repo', 'base-tree-sha', [
        'file1.txt',
        'file2.txt',
      ]);

      expect(result).toBe('tree-sha-123');
      expect(mockOctokit.rest.git.createBlob).not.toHaveBeenCalled();
      expect(mockOctokit.rest.git.createTree).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        base_tree: 'base-tree-sha',
        tree: [
          { path: 'file1.txt', mode: '100644', type: 'blob', content: 'content' },
          { path: 'file2.txt', mode: '100644', type: 'blob', content: 'content' },
        ],
      });
    });

    it('should use createBlob for binary files (NUL in prefix)', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsMock.statSync.mockReturnValue({ mode: 0o644, size: 4 });
      fsMock.readSync.mockImplementation(
        (_fd: number, buf: Buffer, offset = 0, length?: number) => {
          const n = length ?? buf.length - offset;
          buf[offset] = 0;
          if (n > 1) {
            buf.fill(0x62, offset + 1, offset + n);
          }
          return n;
        }
      );
      fsMock.readFileSync.mockImplementation((path: string, enc?: string) => {
        if (enc === 'utf-8') {
          throw new Error('should not read binary as utf-8');
        }
        return Buffer.from([0, 1, 2, 3]);
      });

      mockOctokit.rest.git.createBlob.mockResolvedValue({
        data: { sha: 'blob-bin-sha' },
      });
      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: 'tree-bin' },
      });

      const result = await createTree(mockOctokit as any, 'owner', 'repo', 'base-tree-sha', [
        'file.bin',
      ]);

      expect(result).toBe('tree-bin');
      expect(mockOctokit.rest.git.createBlob).toHaveBeenCalledTimes(1);
      expect(mockOctokit.rest.git.createTree).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        base_tree: 'base-tree-sha',
        tree: [{ path: 'file.bin', mode: '100644', type: 'blob', sha: 'blob-bin-sha' }],
      });
    });

    it('should mix inline content and blob SHAs preserving path order', async () => {
      fsMock.existsSync.mockReturnValue(true);
      let readSyncCalls = 0;
      fsMock.readSync.mockImplementation(
        (_fd: number, buf: Buffer, offset = 0, length?: number) => {
          const n = length ?? buf.length - offset;
          readSyncCalls += 1;
          if (readSyncCalls === 2) {
            buf[offset] = 0;
            if (n > 1) {
              buf.fill(0x64, offset + 1, offset + n);
            }
            return n;
          }
          buf.fill(0x63, offset, offset + n);
          return n;
        }
      );
      fsMock.statSync.mockImplementation(() => ({ mode: 0o644, size: 8 }));
      fsMock.readFileSync.mockImplementation((path: string, enc?: string) => {
        if (path === 'a.txt') {
          if (enc === 'utf-8') {
            return 'hello-a';
          }
          return Buffer.from('hello-a');
        }
        if (path === 'b.bin') {
          if (enc === 'utf-8') {
            throw new Error('binary');
          }
          return Buffer.from([0xff, 0]);
        }
        if (enc === 'utf-8') {
          return 'hello-c';
        }
        return Buffer.from('hello-c');
      });

      mockOctokit.rest.git.createBlob.mockResolvedValue({
        data: { sha: 'blob-b' },
      });
      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: 'tree-mixed' },
      });

      await createTree(mockOctokit as any, 'owner', 'repo', 'base', ['a.txt', 'b.bin', 'c.txt']);

      expect(mockOctokit.rest.git.createBlob).toHaveBeenCalledTimes(1);
      expect(mockOctokit.rest.git.createTree).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        base_tree: 'base',
        tree: [
          { path: 'a.txt', mode: '100644', type: 'blob', content: 'hello-a' },
          { path: 'b.bin', mode: '100644', type: 'blob', sha: 'blob-b' },
          { path: 'c.txt', mode: '100644', type: 'blob', content: 'hello-c' },
        ],
      });
    });

    it('should chain createTree when more than TREE_ENTRY_CHUNK_SIZE files', async () => {
      const n = TREE_ENTRY_CHUNK_SIZE + 1;
      const paths = Array.from({ length: n }, (_, i) => `f${i}.txt`);
      fsMock.existsSync.mockReturnValue(true);
      fsMock.statSync.mockReturnValue({ mode: 0o644, size: 4 });
      fsMock.readFileSync.mockImplementation((path: string, enc?: string) => {
        if (enc === 'utf-8') {
          return 'ab';
        }
        return Buffer.from('ab');
      });

      mockOctokit.rest.git.createTree
        .mockResolvedValueOnce({ data: { sha: 'tree-chunk-1' } })
        .mockResolvedValueOnce({ data: { sha: 'tree-chunk-2' } });

      const result = await createTree(mockOctokit as any, 'owner', 'repo', 'base-tree-sha', paths);

      expect(result).toBe('tree-chunk-2');
      expect(mockOctokit.rest.git.createTree).toHaveBeenCalledTimes(2);
      expect(mockOctokit.rest.git.createTree.mock.calls[0][0].base_tree).toBe('base-tree-sha');
      expect(mockOctokit.rest.git.createTree.mock.calls[0][0].tree).toHaveLength(
        TREE_ENTRY_CHUNK_SIZE
      );
      expect(mockOctokit.rest.git.createTree.mock.calls[1][0].base_tree).toBe('tree-chunk-1');
      expect(mockOctokit.rest.git.createTree.mock.calls[1][0].tree).toHaveLength(1);
      expect(mockOctokit.rest.git.createBlob).not.toHaveBeenCalled();
    });

    it('should chain createTree 3 times for 201 files (2 full chunks + 1)', async () => {
      const n = TREE_ENTRY_CHUNK_SIZE * 2 + 1;
      const paths = Array.from({ length: n }, (_, i) => `f${i}.txt`);
      fsMock.existsSync.mockReturnValue(true);
      fsMock.statSync.mockReturnValue({ mode: 0o644, size: 4 });
      fsMock.readFileSync.mockImplementation((path: string, enc?: string) => {
        if (enc === 'utf-8') {
          return 'ab';
        }
        return Buffer.from('ab');
      });

      mockOctokit.rest.git.createTree
        .mockResolvedValueOnce({ data: { sha: 'tree-chunk-1' } })
        .mockResolvedValueOnce({ data: { sha: 'tree-chunk-2' } })
        .mockResolvedValueOnce({ data: { sha: 'tree-chunk-3' } });

      const result = await createTree(mockOctokit as any, 'owner', 'repo', 'base-tree-sha', paths);

      expect(result).toBe('tree-chunk-3');
      expect(mockOctokit.rest.git.createTree).toHaveBeenCalledTimes(3);
      expect(mockOctokit.rest.git.createTree.mock.calls[0][0].base_tree).toBe('base-tree-sha');
      expect(mockOctokit.rest.git.createTree.mock.calls[0][0].tree).toHaveLength(
        TREE_ENTRY_CHUNK_SIZE
      );
      expect(mockOctokit.rest.git.createTree.mock.calls[1][0].base_tree).toBe('tree-chunk-1');
      expect(mockOctokit.rest.git.createTree.mock.calls[1][0].tree).toHaveLength(
        TREE_ENTRY_CHUNK_SIZE
      );
      expect(mockOctokit.rest.git.createTree.mock.calls[2][0].base_tree).toBe('tree-chunk-2');
      expect(mockOctokit.rest.git.createTree.mock.calls[2][0].tree).toHaveLength(1);
      expect(mockOctokit.rest.git.createBlob).not.toHaveBeenCalled();
    });

    it('should start a new chunk on byte budget before the count limit is reached', async () => {
      // Each file's inline content is 2.5 MB, so 2 fit under TREE_ENTRY_BYTE_LIMIT
      // (6 MB) and the 3rd tips it over: 2 entries per chunk, well below the
      // count cap of 100. 4 files => two chunks of 2.
      const perFileBytes = Math.floor(2.5 * 1024 * 1024);
      const bigContent = 'a'.repeat(perFileBytes);
      const paths = Array.from({ length: 4 }, (_, i) => `big${i}.txt`);

      fsMock.existsSync.mockReturnValue(true);
      // Keep stat.size just under INLINE_CONTENT_SIZE_LIMIT so files stay inline
      // (a size over the limit would route them through createBlob). The chunker
      // measures the actual serialized content bytes, not stat.size, so the
      // large content still drives the byte-budget split.
      fsMock.statSync.mockReturnValue({
        mode: 0o644,
        size: INLINE_CONTENT_SIZE_LIMIT - 1,
      });
      fsMock.readFileSync.mockImplementation((path: string, enc?: string) => {
        if (enc === 'utf-8') {
          return bigContent;
        }
        return Buffer.from(bigContent);
      });

      mockOctokit.rest.git.createTree
        .mockResolvedValueOnce({ data: { sha: 'byte-chunk-1' } })
        .mockResolvedValueOnce({ data: { sha: 'byte-chunk-2' } });

      // Sanity: content dominates and 2 entries stay under the byte limit while
      // 3 would exceed it, and 2 is far below the count cap.
      expect(2 * perFileBytes).toBeLessThan(TREE_ENTRY_BYTE_LIMIT);
      expect(3 * perFileBytes).toBeGreaterThan(TREE_ENTRY_BYTE_LIMIT);
      expect(2).toBeLessThan(TREE_ENTRY_CHUNK_SIZE);

      const result = await createTree(mockOctokit as any, 'owner', 'repo', 'base-tree-sha', paths);

      expect(result).toBe('byte-chunk-2');
      expect(mockOctokit.rest.git.createTree).toHaveBeenCalledTimes(2);
      expect(mockOctokit.rest.git.createBlob).not.toHaveBeenCalled();
      expect(mockOctokit.rest.git.createTree.mock.calls[0][0].tree).toHaveLength(2);
      expect(mockOctokit.rest.git.createTree.mock.calls[0][0].base_tree).toBe('base-tree-sha');
      expect(mockOctokit.rest.git.createTree.mock.calls[1][0].tree).toHaveLength(2);
      expect(mockOctokit.rest.git.createTree.mock.calls[1][0].base_tree).toBe('byte-chunk-1');
    });

    it('should route a single text file above INLINE_CONTENT_SIZE_LIMIT through createBlob', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsMock.statSync.mockReturnValue({
        mode: 0o644,
        size: INLINE_CONTENT_SIZE_LIMIT + 1,
      });
      // readSync marks the file as non-binary (no NUL); default beforeEach fill.
      fsMock.readFileSync.mockReturnValue(Buffer.from('large text'));

      mockOctokit.rest.git.createBlob.mockResolvedValue({
        data: { sha: 'big-text-blob' },
      });
      // mockReset clears any queued mockResolvedValueOnce from prior tests
      // (jest.clearAllMocks does not reset queued once-values).
      mockOctokit.rest.git.createTree.mockReset();
      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: 'tree-big-text' },
      });

      const result = await createTree(mockOctokit as any, 'owner', 'repo', 'base-tree-sha', [
        'huge.txt',
      ]);

      expect(result).toBe('tree-big-text');
      expect(mockOctokit.rest.git.createBlob).toHaveBeenCalledTimes(1);
      expect(mockOctokit.rest.git.createTree).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        base_tree: 'base-tree-sha',
        tree: [
          {
            path: 'huge.txt',
            mode: '100644',
            type: 'blob',
            sha: 'big-text-blob',
          },
        ],
      });
    });

    it('should fall back to createBlob for non-UTF-8 text files (no NUL in prefix)', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsMock.statSync.mockReturnValue({ mode: 0o644, size: 4 });
      fsMock.readSync.mockImplementation(
        (_fd: number, buf: Buffer, offset = 0, length?: number) => {
          const n = length ?? buf.length - offset;
          buf.fill(0xc0, offset, offset + n);
          return n;
        }
      );
      fsMock.readFileSync.mockImplementation(() => {
        return Buffer.from([0x80, 0x81]);
      });

      mockOctokit.rest.git.createBlob.mockResolvedValue({
        data: { sha: 'blob-utf8-fallback' },
      });
      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: 'tree-utf8' },
      });

      await createTree(mockOctokit as any, 'owner', 'repo', 'base', ['latin1.txt']);

      expect(mockOctokit.rest.git.createBlob).toHaveBeenCalledTimes(1);
      expect(mockOctokit.rest.git.createBlob).toHaveBeenCalledWith(
        expect.objectContaining({
          owner: 'owner',
          repo: 'repo',
        })
      );
      expect(mockOctokit.rest.git.createTree).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        base_tree: 'base',
        tree: [
          {
            path: 'latin1.txt',
            mode: '100644',
            type: 'blob',
            sha: 'blob-utf8-fallback',
          },
        ],
      });
    });
  });

  describe('isBinaryFile', () => {
    it('returns false when prefix has no NUL byte', () => {
      fsMock.existsSync.mockReturnValue(true);
      fsMock.statSync.mockReturnValue({ size: 5 });
      fsMock.readSync.mockImplementation(
        (_fd: number, buf: Buffer, offset = 0, length?: number) => {
          const n = length ?? buf.length - offset;
          Buffer.from('hello').copy(buf, offset, 0, n);
          return n;
        }
      );

      expect(isBinaryFile('x.txt')).toBe(false);
    });

    it('returns true when NUL appears in scanned prefix', () => {
      fsMock.existsSync.mockReturnValue(true);
      fsMock.statSync.mockReturnValue({ size: 10 });
      fsMock.readSync.mockImplementation(
        (_fd: number, buf: Buffer, offset = 0, length?: number) => {
          const n = length ?? buf.length - offset;
          buf.fill(0x65, offset, offset + n);
          buf[offset + 2] = 0;
          return n;
        }
      );

      expect(isBinaryFile('x.bin')).toBe(true);
    });

    it('throws when file is missing', () => {
      fsMock.existsSync.mockReturnValue(false);
      expect(() => isBinaryFile('missing')).toThrow('File not found');
    });

    it('returns false when readSync returns fewer bytes than requested (avoids false positive from zero-filled buffer)', () => {
      fsMock.existsSync.mockReturnValue(true);
      fsMock.statSync.mockReturnValue({ size: 100 });
      fsMock.readSync.mockImplementation(
        (_fd: number, buf: Buffer, offset = 0, length?: number) => {
          const n = length ?? buf.length - offset;
          Buffer.from('abc').copy(buf, offset, 0, Math.min(3, n));
          return 3;
        }
      );

      expect(isBinaryFile('x.txt')).toBe(false);
    });
  });

  describe('getFileMode', () => {
    it('returns 100644 for non-executable file', () => {
      fsMock.statSync.mockReturnValue({ mode: 0o644 });
      expect(getFileMode('f')).toBe('100644');
    });

    it('returns 100755 when executable bit is set', () => {
      fsMock.statSync.mockReturnValue({ mode: 0o755 });
      expect(getFileMode('run')).toBe('100755');
    });
  });

  describe('createCommit', () => {
    it('should create a commit', async () => {
      mockOctokit.rest.git.createCommit.mockResolvedValue({
        data: { sha: 'commit-sha-123' },
      });

      const result = await createCommit(
        mockOctokit as any,
        'owner',
        'repo',
        'tree-sha',
        'parent-sha',
        'Test commit'
      );

      expect(result).toBe('commit-sha-123');
      expect(mockOctokit.rest.git.createCommit).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        message: 'Test commit',
        tree: 'tree-sha',
        parents: ['parent-sha'],
      });
    });
  });

  describe('updateBranch', () => {
    it('should update branch reference', async () => {
      mockOctokit.rest.git.updateRef.mockResolvedValue({ data: {} });

      await updateBranch(mockOctokit as any, 'owner', 'repo', 'dev', 'commit-sha', false);

      expect(mockOctokit.rest.git.updateRef).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        ref: 'heads/dev',
        sha: 'commit-sha',
        force: false,
      });
    });
  });

  describe('getBranchInfo', () => {
    it('should get branch SHA and tree SHA', async () => {
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: { object: { sha: 'branch-sha' } },
      });
      mockOctokit.rest.git.getCommit.mockResolvedValue({
        data: { tree: { sha: 'tree-sha' } },
      });

      const result = await getBranchInfo(mockOctokit as any, 'owner', 'repo', 'dev');

      expect(result.sha).toBe('branch-sha');
      expect(result.treeSha).toBe('tree-sha');
    });
  });

  describe('commitViaAPI', () => {
    it('should commit changes end-to-end', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockImplementation((path: string, enc?: string) => {
        if (enc === 'utf-8') {
          return 'content';
        }
        return Buffer.from('content');
      });
      fsMock.statSync.mockReturnValue({ mode: 0o644, size: 7 });

      // Mock branch info
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: { object: { sha: 'base-sha' } },
      });
      mockOctokit.rest.git.getCommit.mockResolvedValue({
        data: { tree: { sha: 'base-tree-sha' } },
      });

      // Mock tree creation
      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: 'new-tree-sha' },
      });

      // Mock commit creation
      mockOctokit.rest.git.createCommit.mockResolvedValue({
        data: { sha: 'commit-sha' },
      });

      // Mock ref update
      mockOctokit.rest.git.updateRef.mockResolvedValue({ data: {} });

      const result = await commitViaAPI({
        token: 'test-token',
        owner: 'owner',
        repo: 'repo',
        branch: 'dev',
        message: 'Test commit',
        filePaths: ['file1.txt', 'file2.txt'],
      });

      expect(result.commitSha).toBe('commit-sha');
      expect(result.treeSha).toBe('new-tree-sha');
      expect(result.filesCommitted).toBe(2);
      expect(mockOctokit.rest.git.createBlob).not.toHaveBeenCalled();
    });

    it('should use provided baseSha if given', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockImplementation((path: string, enc?: string) => {
        if (enc === 'utf-8') {
          return 'content';
        }
        return Buffer.from('content');
      });
      fsMock.statSync.mockReturnValue({ mode: 0o644, size: 7 });

      // Mock commit fetch for baseSha
      mockOctokit.rest.git.getCommit.mockResolvedValue({
        data: { tree: { sha: 'base-tree-sha' } },
      });

      // Mock tree creation
      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: 'new-tree-sha' },
      });

      // Mock commit creation
      mockOctokit.rest.git.createCommit.mockResolvedValue({
        data: { sha: 'commit-sha' },
      });

      // Mock ref update
      mockOctokit.rest.git.updateRef.mockResolvedValue({ data: {} });

      const result = await commitViaAPI({
        token: 'test-token',
        owner: 'owner',
        repo: 'repo',
        branch: 'dev',
        message: 'Test commit',
        filePaths: ['file1.txt'],
        baseSha: 'provided-base-sha',
      });

      expect(mockOctokit.rest.git.getCommit).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        commit_sha: 'provided-base-sha',
      });
      expect(result.commitSha).toBe('commit-sha');
    });

    it('should throw error if no files provided', async () => {
      await expect(
        commitViaAPI({
          token: 'test-token',
          owner: 'owner',
          repo: 'repo',
          branch: 'dev',
          message: 'Test commit',
          filePaths: [],
        })
      ).rejects.toThrow('No files to commit');
    });

    it('should create an empty commit when allowEmpty is true and filePaths is empty', async () => {
      // Mock branch info
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: { object: { sha: 'base-sha' } },
      });
      mockOctokit.rest.git.getCommit.mockResolvedValue({
        data: { tree: { sha: 'base-tree-sha' } },
      });

      // Mock commit creation
      mockOctokit.rest.git.createCommit.mockResolvedValue({
        data: { sha: 'empty-commit-sha' },
      });

      // Mock ref update
      mockOctokit.rest.git.updateRef.mockResolvedValue({ data: {} });

      const result = await commitViaAPI({
        token: 'test-token',
        owner: 'owner',
        repo: 'repo',
        branch: 'dev',
        message: 'Test empty commit',
        filePaths: [],
        allowEmpty: true,
      });

      expect(mockOctokit.rest.git.createBlob).not.toHaveBeenCalled();
      expect(mockOctokit.rest.git.createTree).not.toHaveBeenCalled();
      expect(mockOctokit.rest.git.createCommit).toHaveBeenCalledWith({
        owner: 'owner',
        repo: 'repo',
        message: 'Test empty commit',
        tree: 'base-tree-sha',
        parents: ['base-sha'],
      });
      expect(result.commitSha).toBe('empty-commit-sha');
      expect(result.treeSha).toBe('base-tree-sha');
      expect(result.filesCommitted).toBe(0);
    });

    it('should commit normally when allowEmpty is true and files are provided', async () => {
      fsMock.existsSync.mockReturnValue(true);
      fsMock.readFileSync.mockImplementation((path: string, enc?: string) => {
        if (enc === 'utf-8') {
          return 'content';
        }
        return Buffer.from('content');
      });
      fsMock.statSync.mockReturnValue({ mode: 0o644, size: 7 });

      // Mock branch info
      mockOctokit.rest.git.getRef.mockResolvedValue({
        data: { object: { sha: 'base-sha' } },
      });
      mockOctokit.rest.git.getCommit.mockResolvedValue({
        data: { tree: { sha: 'base-tree-sha' } },
      });

      // Mock tree creation
      mockOctokit.rest.git.createTree.mockResolvedValue({
        data: { sha: 'new-tree-sha' },
      });

      // Mock commit creation
      mockOctokit.rest.git.createCommit.mockResolvedValue({
        data: { sha: 'commit-sha' },
      });

      // Mock ref update
      mockOctokit.rest.git.updateRef.mockResolvedValue({ data: {} });

      const result = await commitViaAPI({
        token: 'test-token',
        owner: 'owner',
        repo: 'repo',
        branch: 'dev',
        message: 'Test commit',
        filePaths: ['file1.txt'],
        allowEmpty: true,
      });

      expect(mockOctokit.rest.git.createTree).toHaveBeenCalled();
      expect(result.commitSha).toBe('commit-sha');
      expect(result.treeSha).toBe('new-tree-sha');
      expect(result.filesCommitted).toBe(1);
    });

    describe('retry behavior', () => {
      it('with maxAttempts 1 (default) does not retry on 404 from getRef', async () => {
        mockOctokit.rest.git.getRef.mockRejectedValue({ status: 404 });
        mockOctokit.rest.git.getCommit.mockResolvedValue({
          data: { tree: { sha: 'base-tree-sha' } },
        });

        await expect(
          commitViaAPI({
            token: 'test-token',
            owner: 'owner',
            repo: 'repo',
            branch: 'dev',
            message: 'Test',
            filePaths: ['x.txt'],
          })
        ).rejects.toMatchObject({ status: 404 });

        expect(mockOctokit.rest.git.getRef).toHaveBeenCalledTimes(1);
      });

      it('with maxAttempts 3 retries transient 404 on getRef and succeeds on second attempt', async () => {
        fsMock.existsSync.mockReturnValue(true);
        fsMock.readFileSync.mockImplementation((path: string, enc?: string) =>
          enc === 'utf-8' ? 'x' : Buffer.from('x')
        );
        fsMock.statSync.mockReturnValue({ mode: 0o644, size: 1 });

        mockOctokit.rest.git.getRef.mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce({
          data: { object: { sha: 'base-sha' } },
        });
        mockOctokit.rest.git.getCommit.mockResolvedValue({
          data: { tree: { sha: 'base-tree-sha' } },
        });
        mockOctokit.rest.git.createTree.mockResolvedValue({
          data: { sha: 'new-tree-sha' },
        });
        mockOctokit.rest.git.createCommit.mockResolvedValue({
          data: { sha: 'commit-sha' },
        });
        mockOctokit.rest.git.updateRef.mockResolvedValue({ data: {} });

        const result = await commitViaAPI({
          token: 'test-token',
          owner: 'owner',
          repo: 'repo',
          branch: 'dev',
          message: 'Test',
          filePaths: ['x.txt'],
          maxAttempts: 3,
          baseDelayMs: 1,
          maxDelayMs: 5,
        });

        expect(result.commitSha).toBe('commit-sha');
        expect(mockOctokit.rest.git.getRef).toHaveBeenCalledTimes(2);
      });

      it('with maxAttempts 2 retries 503 on createCommit and succeeds', async () => {
        fsMock.existsSync.mockReturnValue(true);
        fsMock.readFileSync.mockImplementation((path: string, enc?: string) =>
          enc === 'utf-8' ? 'x' : Buffer.from('x')
        );
        fsMock.statSync.mockReturnValue({ mode: 0o644, size: 1 });

        mockOctokit.rest.git.getRef.mockResolvedValue({
          data: { object: { sha: 'base-sha' } },
        });
        mockOctokit.rest.git.getCommit.mockResolvedValue({
          data: { tree: { sha: 'base-tree-sha' } },
        });
        mockOctokit.rest.git.createTree.mockResolvedValue({
          data: { sha: 'new-tree-sha' },
        });
        mockOctokit.rest.git.createCommit
          .mockRejectedValueOnce({ status: 503 })
          .mockResolvedValueOnce({ data: { sha: 'commit-sha' } });
        mockOctokit.rest.git.updateRef.mockResolvedValue({ data: {} });

        const result = await commitViaAPI({
          token: 'test-token',
          owner: 'owner',
          repo: 'repo',
          branch: 'dev',
          message: 'Test',
          filePaths: ['x.txt'],
          maxAttempts: 2,
          baseDelayMs: 1,
          maxDelayMs: 5,
        });

        expect(result.commitSha).toBe('commit-sha');
        expect(mockOctokit.rest.git.createCommit).toHaveBeenCalledTimes(2);
      });

      it('exhausts attempts and surfaces original error', async () => {
        fsMock.existsSync.mockReturnValue(true);
        fsMock.readFileSync.mockImplementation((path: string, enc?: string) =>
          enc === 'utf-8' ? 'x' : Buffer.from('x')
        );
        fsMock.statSync.mockReturnValue({ mode: 0o644, size: 1 });

        mockOctokit.rest.git.getRef.mockRejectedValue({ status: 404 });
        mockOctokit.rest.git.getCommit.mockResolvedValue({
          data: { tree: { sha: 'base-tree-sha' } },
        });

        await expect(
          commitViaAPI({
            token: 'test-token',
            owner: 'owner',
            repo: 'repo',
            branch: 'dev',
            message: 'Test',
            filePaths: ['x.txt'],
            maxAttempts: 2,
            baseDelayMs: 1,
            maxDelayMs: 5,
          })
        ).rejects.toMatchObject({ status: 404 });

        expect(mockOctokit.rest.git.getRef).toHaveBeenCalledTimes(2);
      });

      it('retries only the failing createTree chunk, not already-succeeded blobs/trees', async () => {
        const n = TREE_ENTRY_CHUNK_SIZE + 1;
        const paths = Array.from({ length: n }, (_, i) => `f${i}.txt`);
        fsMock.existsSync.mockReturnValue(true);
        fsMock.statSync.mockReturnValue({ mode: 0o644, size: 2 });
        fsMock.readFileSync.mockImplementation((path: string, enc?: string) =>
          enc === 'utf-8' ? 'ab' : Buffer.from('ab')
        );

        mockOctokit.rest.git.getRef.mockResolvedValue({
          data: { object: { sha: 'base-sha' } },
        });
        mockOctokit.rest.git.getCommit.mockResolvedValue({
          data: { tree: { sha: 'base-tree-sha' } },
        });
        // First chunk succeeds; second chunk fails transiently once, then succeeds.
        mockOctokit.rest.git.createTree
          .mockResolvedValueOnce({ data: { sha: 'tree-chunk-1' } })
          .mockRejectedValueOnce({ status: 503 })
          .mockResolvedValueOnce({ data: { sha: 'tree-chunk-2' } });
        mockOctokit.rest.git.createCommit.mockResolvedValue({
          data: { sha: 'commit-sha' },
        });
        mockOctokit.rest.git.updateRef.mockResolvedValue({ data: {} });

        const result = await commitViaAPI({
          token: 'test-token',
          owner: 'owner',
          repo: 'repo',
          branch: 'dev',
          message: 'Test',
          filePaths: paths,
          maxAttempts: 2,
          baseDelayMs: 1,
          maxDelayMs: 5,
        });

        expect(result.treeSha).toBe('tree-chunk-2');
        // 3 calls total: chunk-1 (once), chunk-2 (fail + retry). The first
        // chunk is NOT re-uploaded when the second chunk fails mid-batch.
        expect(mockOctokit.rest.git.createTree).toHaveBeenCalledTimes(3);
        expect(mockOctokit.rest.git.createTree.mock.calls[0][0].base_tree).toBe('base-tree-sha');
        // The retried (2nd) call and its retry (3rd) target the same chunk,
        // chained onto the first chunk's result — proving no re-run of chunk 1.
        expect(mockOctokit.rest.git.createTree.mock.calls[1][0].base_tree).toBe('tree-chunk-1');
        expect(mockOctokit.rest.git.createTree.mock.calls[2][0].base_tree).toBe('tree-chunk-1');
        expect(mockOctokit.rest.git.createBlob).not.toHaveBeenCalled();
      });

      it('retries a failing createBlob without re-uploading earlier blobs', async () => {
        fsMock.existsSync.mockReturnValue(true);
        fsMock.statSync.mockReturnValue({ mode: 0o644, size: 4 });
        // Both files are binary (NUL in prefix) -> each needs createBlob.
        fsMock.readSync.mockImplementation(
          (_fd: number, buf: Buffer, offset = 0, length?: number) => {
            const nn = length ?? buf.length - offset;
            buf[offset] = 0;
            if (nn > 1) {
              buf.fill(0x62, offset + 1, offset + nn);
            }
            return nn;
          }
        );
        fsMock.readFileSync.mockImplementation(() => Buffer.from([0, 1, 2, 3]));

        mockOctokit.rest.git.getRef.mockResolvedValue({
          data: { object: { sha: 'base-sha' } },
        });
        mockOctokit.rest.git.getCommit.mockResolvedValue({
          data: { tree: { sha: 'base-tree-sha' } },
        });
        // First blob succeeds; second blob fails transiently once, then succeeds.
        mockOctokit.rest.git.createBlob
          .mockResolvedValueOnce({ data: { sha: 'blob-1' } })
          .mockRejectedValueOnce({ status: 503 })
          .mockResolvedValueOnce({ data: { sha: 'blob-2' } });
        mockOctokit.rest.git.createTree.mockResolvedValue({
          data: { sha: 'new-tree-sha' },
        });
        mockOctokit.rest.git.createCommit.mockResolvedValue({
          data: { sha: 'commit-sha' },
        });
        mockOctokit.rest.git.updateRef.mockResolvedValue({ data: {} });

        const result = await commitViaAPI({
          token: 'test-token',
          owner: 'owner',
          repo: 'repo',
          branch: 'dev',
          message: 'Test',
          filePaths: ['a.bin', 'b.bin'],
          maxAttempts: 2,
          baseDelayMs: 1,
          maxDelayMs: 5,
        });

        expect(result.commitSha).toBe('commit-sha');
        // 3 total: blob-1 (once), blob-2 (fail + retry). blob-1 not re-uploaded.
        expect(mockOctokit.rest.git.createBlob).toHaveBeenCalledTimes(3);
        // The single createTree carries both resolved blob SHAs.
        expect(mockOctokit.rest.git.createTree).toHaveBeenCalledTimes(1);
        expect(mockOctokit.rest.git.createTree.mock.calls[0][0].tree).toEqual([
          { path: 'a.bin', mode: '100644', type: 'blob', sha: 'blob-1' },
          { path: 'b.bin', mode: '100644', type: 'blob', sha: 'blob-2' },
        ]);
      });

      it('calls logger on retry', async () => {
        const logger = jest.fn<AnyFn>();
        fsMock.existsSync.mockReturnValue(true);
        fsMock.readFileSync.mockImplementation((path: string, enc?: string) =>
          enc === 'utf-8' ? 'x' : Buffer.from('x')
        );
        fsMock.statSync.mockReturnValue({ mode: 0o644, size: 1 });

        mockOctokit.rest.git.getRef.mockRejectedValueOnce({ status: 404 }).mockResolvedValueOnce({
          data: { object: { sha: 'base-sha' } },
        });
        mockOctokit.rest.git.getCommit.mockResolvedValue({
          data: { tree: { sha: 'base-tree-sha' } },
        });
        mockOctokit.rest.git.createTree.mockResolvedValue({
          data: { sha: 'new-tree-sha' },
        });
        mockOctokit.rest.git.createCommit.mockResolvedValue({
          data: { sha: 'commit-sha' },
        });
        mockOctokit.rest.git.updateRef.mockResolvedValue({ data: {} });

        await commitViaAPI({
          token: 'test-token',
          owner: 'owner',
          repo: 'repo',
          branch: 'dev',
          message: 'Test',
          filePaths: ['x.txt'],
          maxAttempts: 3,
          baseDelayMs: 1,
          maxDelayMs: 5,
          logger,
        });

        expect(logger).toHaveBeenCalled();
        expect(logger.mock.calls[0][0]).toMatch(/attempt|404|retry/i);
      });
    });
  });
});
